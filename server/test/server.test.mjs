import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-test-'))
const dbPath = path.join(tempDir, 'zashboard.sqlite')
const ruleSourcePath = path.join(tempDir, 'rule-source.yaml')

await fs.writeFile(
  ruleSourcePath,
  `rule-providers:
  streaming:
    type: http
    behavior: domain
    format: text
    interval: 3600
    url: https://example.test/streaming.txt
`,
  'utf8',
)

process.env.ZASHBOARD_DB_PATH = dbPath
process.env.ZASHBOARD_RULE_SOURCE_PATH = ruleSourcePath

const serverModuleUrl = new URL(`./../index.mjs?test=${Date.now()}`, import.meta.url)
const {
  createAccessSessionTokenForTesting,
  getRequestAccessAuthStatusForTesting,
  replaceSnapshot,
  searchRuleProviderCache,
  seedRuleProviderCacheForTesting,
  shutdownServer,
} = await import(serverModuleUrl.href)

after(async () => {
  await shutdownServer().catch(() => {})
  await fs.rm(tempDir, { recursive: true, force: true })
})

test('service auth state is enforced from persisted settings', () => {
  replaceSnapshot({
    'config/access-password-enabled': 'true',
    'config/access-password': 'test-secret',
  })

  assert.deepEqual(
    getRequestAccessAuthStatusForTesting({
      headers: {},
    }),
    {
      enabled: true,
      authenticated: false,
    },
  )

  assert.deepEqual(
    getRequestAccessAuthStatusForTesting({
      headers: {
        cookie: `dashboard_access_session=${createAccessSessionTokenForTesting('test-secret')}`,
      },
    }),
    {
      enabled: true,
      authenticated: true,
    },
  )
})

test('rule provider search returns cached matches', async () => {
  seedRuleProviderCacheForTesting([
    {
      name: 'streaming',
      behavior: 'domain',
      format: 'text',
      url: 'https://example.test/streaming.txt',
      body: `DOMAIN-SUFFIX,netflix.com
DOMAIN,api.openai.com
`,
    },
  ])

  const payload = await searchRuleProviderCache('www.netflix.com')

  assert.equal(payload.totalProviders, 1)
  assert.equal(payload.cachedProviders, 1)
  assert.equal(payload.matches.length, 1)
  assert.equal(payload.matches[0].name, 'streaming')
  assert.equal(payload.matches[0].totalRules, 2)
  assert.deepEqual(payload.matches[0].matches[0], {
    line: 1,
    value: 'netflix.com',
    mode: 'suffix',
    raw: 'DOMAIN-SUFFIX,netflix.com',
  })
})
