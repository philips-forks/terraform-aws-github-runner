import * as ghAuth from '../github/auth';
import * as scaleUpModule from './scale-up';
import type { ActionRequestMessageSQS } from './types';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';

vi.mock('../github/auth', () => ({
  createGithubAppAuth: vi.fn(),
  createGithubInstallationAuth: vi.fn(),
  createOctokitClient: vi.fn(),
  getStoredInstallationId: vi.fn(),
}));

vi.mock('./github-runner', () => ({
  getGitHubEnterpriseApiUrl: vi.fn().mockReturnValue({ ghesApiUrl: '', ghesBaseUrl: undefined }),
  getInstallationId: vi.fn().mockImplementation(async (_client, _org, payload) => payload.installationId),
  resolveInstallationId: vi.fn(),
  isJobQueued: vi.fn().mockResolvedValue(true),
  UnsupportedEventError: class UnsupportedEventError extends Error {},
  validateSsmParameterStoreTags: vi.fn().mockReturnValue([]),
}));

vi.mock('./job-retry', () => ({
  publishRetryMessage: vi.fn(),
}));

vi.mock('../runner-provider-registry', () => ({
  createScaleUpRunnerProvider: vi.fn().mockReturnValue({
    prepareGroup: vi.fn().mockResolvedValue({
      runnerLabels: ['linux', 'arm64'],
      runnerGroup: 'Default',
      scaleUpData: {},
    }),
    getCurrentRunners: vi.fn().mockResolvedValue(0),
    scaleUp: vi.fn().mockResolvedValue({ instanceIds: ['i-123'], skippedRunnerCount: 0 }),
  }),
}));

const mockLogger = vi.hoisted(() => {
  const logger: Record<string, any> = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    createChild: vi.fn(),
  };
  logger.createChild.mockReturnValue(logger);
  return logger;
});

vi.mock('@aws-github-runner/aws-powertools-util', () => ({
  createChildLogger: () => mockLogger,
  addPersistentContextToChildLogger: vi.fn(),
}));

vi.mock('@aws-github-runner/runner-provider', () => ({
  resolveRunnerProviderType: vi.fn().mockReturnValue('ec2'),
}));

const mockedAppAuth = vi.mocked(ghAuth.createGithubAppAuth);
const mockedInstallationAuth = vi.mocked(ghAuth.createGithubInstallationAuth);
const mockedOctokitClient = vi.mocked(ghAuth.createOctokitClient);

describe('multi-app: installation auth must use the same appIndex as app auth', () => {
  const payload: ActionRequestMessageSQS[] = [
    {
      id: 1,
      eventType: 'workflow_job',
      repositoryName: 'my-repo',
      repositoryOwner: 'my-org',
      installationId: 36190402,
      repoOwnerType: 'Organization',
      messageId: 'msg-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.ENABLE_ORGANIZATION_RUNNERS = 'true';
    process.env.RUNNERS_MAXIMUM_COUNT = '10';
    process.env.RUNNER_LABELS = 'linux,arm64';
    process.env.RUNNER_GROUP_NAME = 'Default';
    process.env.ENABLE_EPHEMERAL_RUNNERS = 'true';
    process.env.ENABLE_JIT_CONFIG = 'true';
    process.env.ENABLE_JOB_QUEUED_CHECK = 'false';
    process.env.RUNNER_NAME_PREFIX = 'test-';
    process.env.RUNNER_PROVIDER_TYPE = 'ec2';

    mockedOctokitClient.mockResolvedValue({
      apps: {
        getOrgInstallation: vi.fn(),
        getRepoInstallation: vi.fn(),
      },
    } as unknown as import('@octokit/rest').Octokit);
  });

  it('passes appIndex from createGithubAppAuth to createGithubInstallationAuth', async () => {
    // Simulate multi-app: app auth randomly selects the additional app (index 1)
    mockedAppAuth.mockResolvedValue({
      token: 'app-jwt-token',
      appIndex: 1,
      type: 'app',
      expiresAt: '',
    } as ReturnType<typeof ghAuth.createGithubAppAuth> extends Promise<infer T> ? T : never);

    mockedInstallationAuth.mockResolvedValue({
      token: 'installation-token',
      type: 'token',
      tokenType: 'installation',
      installationId: 36190402,
      expiresAt: new Date().toISOString(),
      permissions: {},
      repositorySelection: 'all',
    } as unknown as Awaited<ReturnType<typeof ghAuth.createGithubInstallationAuth>>);

    await scaleUpModule.scaleUp(payload);

    // The critical assertion: createGithubInstallationAuth must be called with
    // the same appIndex (1) that createGithubAppAuth returned, ensuring the
    // same app's credentials are used to create the installation token.
    expect(mockedInstallationAuth).toHaveBeenCalledWith(
      36190402, // installationId from payload
      '',       // ghesApiUrl
      1,        // appIndex — MUST match createGithubAppAuth's returned appIndex
    );
  });

  it('works when primary app (index 0) is selected', async () => {
    mockedAppAuth.mockResolvedValue({
      token: 'app-jwt-token',
      appIndex: 0,
      type: 'app',
      expiresAt: '',
    } as ReturnType<typeof ghAuth.createGithubAppAuth> extends Promise<infer T> ? T : never);

    mockedInstallationAuth.mockResolvedValue({
      token: 'installation-token',
      type: 'token',
      tokenType: 'installation',
      installationId: 36190402,
      expiresAt: new Date().toISOString(),
      permissions: {},
      repositorySelection: 'all',
    } as unknown as Awaited<ReturnType<typeof ghAuth.createGithubInstallationAuth>>);

    await scaleUpModule.scaleUp(payload);

    expect(mockedInstallationAuth).toHaveBeenCalledWith(
      36190402,
      '',
      0, // appIndex must be 0 when primary app was selected
    );
  });
});
