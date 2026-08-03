import * as ghAuth from '../github/auth';
import * as scaleUpModule from './scale-up';
import * as githubRunner from './github-runner';
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
const mockedGetStoredInstallationId = vi.mocked(ghAuth.getStoredInstallationId);
const mockedResolveInstallationId = vi.mocked(githubRunner.resolveInstallationId);

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

  it('uses stored installation ID and correct appIndex for additional app (index 1)', async () => {
    mockedAppAuth.mockResolvedValue({
      token: 'app-jwt-token',
      appIndex: 1,
      type: 'app',
      expiresAt: '',
    } as ReturnType<typeof ghAuth.createGithubAppAuth> extends Promise<infer T> ? T : never);

    // The stored installation ID for app 1 — avoids using the webhook payload's ID
    mockedGetStoredInstallationId.mockResolvedValue(150968403);

    mockedInstallationAuth.mockResolvedValue({
      token: 'installation-token',
      type: 'token',
      tokenType: 'installation',
      installationId: 150968403,
      expiresAt: new Date().toISOString(),
      permissions: {},
      repositorySelection: 'all',
    } as unknown as Awaited<ReturnType<typeof ghAuth.createGithubInstallationAuth>>);

    await scaleUpModule.scaleUp(payload);

    // Must use the stored installation ID for app 1, NOT the webhook payload's ID
    expect(mockedGetStoredInstallationId).toHaveBeenCalledWith(1);
    expect(mockedInstallationAuth).toHaveBeenCalledWith(
      150968403, // stored installation ID for app 1
      '',
      1,         // appIndex
    );
    // Should NOT call resolveInstallationId since stored ID was available
    expect(mockedResolveInstallationId).not.toHaveBeenCalled();
  });

  it('resolves installation ID via API when no stored ID exists for additional app', async () => {
    mockedAppAuth.mockResolvedValue({
      token: 'app-jwt-token',
      appIndex: 1,
      type: 'app',
      expiresAt: '',
    } as ReturnType<typeof ghAuth.createGithubAppAuth> extends Promise<infer T> ? T : never);

    // No stored installation ID for this app
    mockedGetStoredInstallationId.mockResolvedValue(undefined);
    mockedResolveInstallationId.mockResolvedValue(150968403);

    mockedInstallationAuth.mockResolvedValue({
      token: 'installation-token',
      type: 'token',
      tokenType: 'installation',
      installationId: 150968403,
      expiresAt: new Date().toISOString(),
      permissions: {},
      repositorySelection: 'all',
    } as unknown as Awaited<ReturnType<typeof ghAuth.createGithubInstallationAuth>>);

    await scaleUpModule.scaleUp(payload);

    // Must NOT use the payload's installationId (36190402) — that belongs to app 0
    expect(mockedResolveInstallationId).toHaveBeenCalled();
    expect(mockedInstallationAuth).toHaveBeenCalledWith(
      150968403, // resolved via API for app 1
      '',
      1,
    );
  });

  it('uses payload installationId for primary app (index 0) without stored ID', async () => {
    mockedAppAuth.mockResolvedValue({
      token: 'app-jwt-token',
      appIndex: 0,
      type: 'app',
      expiresAt: '',
    } as ReturnType<typeof ghAuth.createGithubAppAuth> extends Promise<infer T> ? T : never);

    // No stored installation ID
    mockedGetStoredInstallationId.mockResolvedValue(undefined);

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

    // Primary app CAN use the webhook payload's installation ID
    expect(mockedInstallationAuth).toHaveBeenCalledWith(
      36190402, // from payload — valid for primary app
      '',
      0,
    );
    expect(mockedResolveInstallationId).not.toHaveBeenCalled();
  });

  it('uses stored installation ID for primary app when available', async () => {
    mockedAppAuth.mockResolvedValue({
      token: 'app-jwt-token',
      appIndex: 0,
      type: 'app',
      expiresAt: '',
    } as ReturnType<typeof ghAuth.createGithubAppAuth> extends Promise<infer T> ? T : never);

    // Stored ID takes precedence even for primary app
    mockedGetStoredInstallationId.mockResolvedValue(99999);

    mockedInstallationAuth.mockResolvedValue({
      token: 'installation-token',
      type: 'token',
      tokenType: 'installation',
      installationId: 99999,
      expiresAt: new Date().toISOString(),
      permissions: {},
      repositorySelection: 'all',
    } as unknown as Awaited<ReturnType<typeof ghAuth.createGithubInstallationAuth>>);

    await scaleUpModule.scaleUp(payload);

    expect(mockedInstallationAuth).toHaveBeenCalledWith(
      99999, // stored ID preferred over payload
      '',
      0,
    );
    expect(mockedResolveInstallationId).not.toHaveBeenCalled();
  });
});
