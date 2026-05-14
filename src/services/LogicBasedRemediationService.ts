import type { SeverityContext } from '../types/severity';

export type RemediationConfidence = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RemediationSuggestion {
  issueId: string;
  problem: string;
  explanation: string;
  severity: string;
  currentCodeBad?: string;
  suggestedCodeGood?: string;
  steps: string[];
  estimatedFixTimeMinutes: number;
  performanceGainMs?: number;
  performanceGainPercent?: number;
  envVarNeeded?: string;
  relatedIssues?: string[];
  confidence: RemediationConfidence;
}

interface RuleDefinition {
  problem: string;
  explanation: string;
  severity: string;
  currentCodeBad?: string;
  suggestedCodeGood?: string;
  steps: string[];
  estimatedFixTimeMinutes: number;
  performanceGainMs?: number;
  performanceGainPercent?: number;
  envVarNeeded?: string;
  relatedIssues?: string[];
  confidence: RemediationConfidence;
}

export class LogicBasedRemediationService {
  private readonly rules = new Map<string, RuleDefinition>();

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // ── Security ──────────────────────────────────────────────────────────────

    this.rules.set('SQL_INJECTION', {
      problem: 'SQL query built with string concatenation — SQL Injection risk',
      explanation: 'Concatenating user input into SQL queries allows attackers to inject malicious SQL. Use parameterized queries.',
      severity: 'Critical',
      currentCodeBad: `const query = "SELECT * FROM users WHERE id = " + userId\ndb.query(query)`,
      suggestedCodeGood: `const query = "SELECT * FROM users WHERE id = ?"\ndb.query(query, [userId])`,
      steps: [
        'Find the SQL query vulnerable to injection',
        'Replace string concatenation with ? placeholders',
        'Pass variables as a separate array parameter',
        'Test with inputs containing quotes and semicolons',
      ],
      estimatedFixTimeMinutes: 5,
      relatedIssues: ['NO_INPUT_VALIDATION'],
      confidence: 'CRITICAL',
    });

    this.rules.set('XSS', {
      problem: 'User input inserted directly into HTML — XSS risk',
      explanation: 'innerHTML can execute scripts. Inserting unsanitized user input allows attackers to inject malicious JavaScript.',
      severity: 'Critical',
      currentCodeBad: `element.innerHTML = userInput`,
      suggestedCodeGood: `const sanitized = DOMPurify.sanitize(userInput)\nelement.innerHTML = sanitized\n// OR safer:\nelement.textContent = userInput`,
      steps: [
        'Replace innerHTML with textContent for plain text',
        'If HTML is required, use DOMPurify.sanitize()',
        'Never use innerHTML with raw user data',
        'Test with <script>, <img onerror>, event handler payloads',
      ],
      estimatedFixTimeMinutes: 5,
      relatedIssues: ['DANGEROUS_HTML', 'NO_INPUT_VALIDATION'],
      confidence: 'CRITICAL',
    });

    this.rules.set('DANGEROUS_HTML', {
      problem: 'dangerouslySetInnerHTML used without sanitization (React)',
      explanation: 'dangerouslySetInnerHTML bypasses React safety checks. Only use it with sanitized or fully trusted content.',
      severity: 'Critical',
      currentCodeBad: `return <div dangerouslySetInnerHTML={{ __html: userContent }} />`,
      suggestedCodeGood: `import DOMPurify from 'dompurify'\nreturn <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />`,
      steps: [
        "If plain text is sufficient, use textContent / innerText",
        'If HTML is required, wrap with DOMPurify.sanitize()',
        'Consider react-markdown or highlight.js for rich content',
        'Never use with unsanitized user input',
        'Test with XSS payloads: <img onerror>, <script>',
      ],
      estimatedFixTimeMinutes: 5,
      relatedIssues: ['XSS'],
      confidence: 'CRITICAL',
    });

    this.rules.set('COMMAND_INJECTION', {
      problem: 'User input passed directly to shell commands',
      explanation: 'Shell commands with unsanitized input allow attackers to execute arbitrary commands on the server.',
      severity: 'Critical',
      currentCodeBad: `const result = exec('ls ' + userDirectory)`,
      suggestedCodeGood: `const result = execFile('ls', [userDirectory])`,
      steps: [
        'Replace exec() with execFile() or spawn()',
        'execFile does not invoke a shell — prevents injection',
        'Pass arguments as an array, never concatenate',
        'Whitelist allowed input values where possible',
        "Test with: ; ls; | cat /etc/passwd; etc.",
      ],
      estimatedFixTimeMinutes: 7,
      relatedIssues: ['NO_INPUT_VALIDATION'],
      confidence: 'CRITICAL',
    });

    this.rules.set('AWS_ACCESS_KEY', {
      problem: 'AWS credentials hardcoded in source code',
      explanation: 'AWS credentials in code are a severe security risk. Anyone with repository access can spin up expensive resources or exfiltrate data.',
      severity: 'Critical',
      currentCodeBad: `const s3 = new AWS.S3({\n  accessKeyId: 'AKIA2345...',\n  secretAccessKey: 'abc123...'\n})`,
      suggestedCodeGood: `const s3 = new AWS.S3({ region: process.env.AWS_REGION })\n// Credentials from IAM role or environment variables`,
      steps: [
        'Remove all hardcoded AWS credentials immediately',
        'Use IAM roles when running on AWS infrastructure',
        'Use AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars for local dev',
        'ROTATE the exposed credentials immediately',
        'Check CloudTrail for unauthorized usage',
        'Update all environments (dev / staging / prod)',
      ],
      estimatedFixTimeMinutes: 10,
      envVarNeeded: 'AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY',
      relatedIssues: ['PASSWORD', 'API_KEY'],
      confidence: 'CRITICAL',
    });

    this.rules.set('PASSWORD', {
      problem: 'Hardcoded password in source code',
      explanation: 'Secrets in code are exposed in version control, logs, and builds. Always use environment variables.',
      severity: 'Critical',
      currentCodeBad: `const password = "admin123"`,
      suggestedCodeGood: `const password = process.env.DB_PASSWORD\nif (!password) throw new Error('DB_PASSWORD env var not set')`,
      steps: [
        'Create a .env file (or use the existing one)',
        'Add the secret: DB_PASSWORD=your_actual_password',
        'Replace the hardcoded value with process.env.DB_PASSWORD',
        'Add a startup check that throws if the variable is missing',
        'Ensure .env is listed in .gitignore',
        'Create .env.example with placeholder values for collaborators',
      ],
      estimatedFixTimeMinutes: 3,
      envVarNeeded: 'DB_PASSWORD',
      relatedIssues: ['API_KEY'],
      confidence: 'CRITICAL',
    });

    this.rules.set('API_KEY', {
      problem: 'API key hardcoded in source code',
      explanation: 'API keys grant account access. Hardcoding them exposes them via git history, PR reviews, and logs.',
      severity: 'Critical',
      currentCodeBad: `const apiKey = "pk_test_51H2lZ2..."`,
      suggestedCodeGood: `const apiKey = process.env.API_KEY\nif (!apiKey) throw new Error('API_KEY not set')`,
      steps: [
        'Move the key to an environment variable',
        'Add a null-check with a descriptive error message',
        'Rotate the actual key — it may already be exposed',
        'Update CI/CD secrets and all environments',
        'Verify no backups or logs contain the old key',
      ],
      estimatedFixTimeMinutes: 5,
      envVarNeeded: 'API_KEY',
      confidence: 'CRITICAL',
    });

    // ── Code Quality ──────────────────────────────────────────────────────────

    this.rules.set('CONSOLE_LOG', {
      problem: 'console.log found in production code',
      explanation: 'console.log clutters logs, may expose internal state, and should be replaced with a structured logger.',
      severity: 'Medium',
      currentCodeBad: `console.log("User object:", user)`,
      suggestedCodeGood: `logger.debug("User object:", { userId: user.id })\n// Or remove entirely if it is debug code`,
      steps: [
        'Review each console.log to determine its purpose',
        'If it is debug output: remove it',
        'If logging is required: use logger.debug / info / error',
        'Never log sensitive data (passwords, tokens)',
        'Use structured (JSON) logging in production',
      ],
      estimatedFixTimeMinutes: 2,
      relatedIssues: ['SENSITIVE_DATA_LOG'],
      confidence: 'HIGH',
    });

    this.rules.set('EMPTY_CATCH', {
      problem: 'Empty catch block silently ignores errors',
      explanation: 'Catching errors without handling them hides bugs and makes debugging impossible.',
      severity: 'High',
      currentCodeBad: `try {\n  riskyOperation()\n} catch (e) {\n  // Empty\n}`,
      suggestedCodeGood: `try {\n  riskyOperation()\n} catch (e) {\n  logger.error('riskyOperation failed:', e)\n  return defaultValue\n}`,
      steps: [
        'At minimum, log the error with context',
        'Decide whether the error should bubble up or be handled locally',
        'If handled, provide a meaningful fallback',
        'Never silently ignore errors in production code',
      ],
      estimatedFixTimeMinutes: 5,
      relatedIssues: ['UNHANDLED_PROMISE'],
      confidence: 'HIGH',
    });

    this.rules.set('TODO_FIXME', {
      problem: 'TODO / FIXME comment left in code',
      explanation: 'TODO comments often indicate incomplete work. Convert them to tracked issues or remove them.',
      severity: 'Low',
      currentCodeBad: `// TODO: Add error handling here\n// FIXME: Performance issue`,
      suggestedCodeGood: `// Tracked: GitHub issue #123\n// Or simply remove if already done`,
      steps: [
        'Review whether the TODO is still relevant',
        'If yes: create a GitHub issue and reference it',
        'If no: remove the comment',
        'Use a consistent format: // Tracked: GitHub issue #<n>',
      ],
      estimatedFixTimeMinutes: 2,
      confidence: 'MEDIUM',
    });

    this.rules.set('MAGIC_NUMBER', {
      problem: 'Magic number used without a named constant',
      explanation: 'Unexplained numeric literals make code hard to understand and maintain. Use named constants.',
      severity: 'Low',
      currentCodeBad: `if (age > 18) { ... }\nif (attempts > 3) { ... }`,
      suggestedCodeGood: `const LEGAL_AGE = 18\nconst MAX_ATTEMPTS = 3\nif (age > LEGAL_AGE) { ... }`,
      steps: [
        'Identify the magic number and its intent',
        'Create a named constant using SCREAMING_SNAKE_CASE',
        'Add a brief comment if the value is non-obvious',
        'Group related constants in a dedicated file',
      ],
      estimatedFixTimeMinutes: 2,
      confidence: 'MEDIUM',
    });

    // ── Scalability ───────────────────────────────────────────────────────────

    this.rules.set('N_PLUS_ONE', {
      problem: 'Database query inside a loop — N+1 query pattern',
      explanation: 'Each loop iteration fires a DB query. With 1 000 items that is 1 000 queries. Batch into a single query instead.',
      severity: 'High',
      currentCodeBad: `for (const user of users) {\n  const orders = await db.query('SELECT * FROM orders WHERE user_id = ?', [user.id])\n}`,
      suggestedCodeGood: `const userIds = users.map(u => u.id)\nconst orders = await db.query('SELECT * FROM orders WHERE user_id IN (?)', [userIds])\n// Then map results in application code`,
      steps: [
        'Identify the query inside the loop',
        'Extract all IDs / keys from loop items',
        'Make ONE query using an IN clause or JOIN',
        'Map results back to the items in application code',
        'Test with 1 000+ items to verify the improvement',
      ],
      estimatedFixTimeMinutes: 10,
      performanceGainMs: 0.45,
      performanceGainPercent: 95,
      relatedIssues: ['SEQUENTIAL_ASYNC', 'NO_PAGINATION'],
      confidence: 'HIGH',
    });

    this.rules.set('SEQUENTIAL_ASYNC', {
      problem: 'Sequential awaits can be parallelized',
      explanation: 'Independent async operations awaited in sequence waste time. Use Promise.all for concurrent execution.',
      severity: 'High',
      currentCodeBad: `const user = await fetchUser(id)\nconst orders = await fetchOrders(id)`,
      suggestedCodeGood: `const [user, orders] = await Promise.all([\n  fetchUser(id),\n  fetchOrders(id)\n])`,
      steps: [
        'Identify sequential awaits in the same function',
        'Verify the operations are independent (no data dependency)',
        'Wrap in Promise.all([...]) for concurrent execution',
        'Use Promise.allSettled if one failure should not cancel others',
        'Test that all results are still correct after the change',
      ],
      estimatedFixTimeMinutes: 5,
      performanceGainMs: 200,
      relatedIssues: ['N_PLUS_ONE'],
      confidence: 'HIGH',
    });

    this.rules.set('NO_PAGINATION', {
      problem: 'Query returns all rows without a LIMIT clause',
      explanation: 'Fetching unlimited rows can cause out-of-memory errors and slow responses on large tables. Always paginate.',
      severity: 'Medium',
      currentCodeBad: `SELECT * FROM users`,
      suggestedCodeGood: `SELECT id, name FROM users LIMIT 50 OFFSET 0`,
      steps: [
        'Add LIMIT and OFFSET (or cursor-based pagination) to the query',
        'Accept page / limit parameters from the caller',
        'Select only the columns actually needed instead of SELECT *',
        'Add an index on the ORDER BY column for efficient sorting',
      ],
      estimatedFixTimeMinutes: 5,
      relatedIssues: ['N_PLUS_ONE'],
      confidence: 'HIGH',
    });

    this.rules.set('NESTED_LOOP', {
      problem: 'Nested loops create O(n²) complexity',
      explanation: 'Each additional nesting multiplies iterations. Replace the inner loop with a Map for O(1) lookups.',
      severity: 'Medium',
      currentCodeBad: `users.forEach(user => {\n  orders.forEach(order => {\n    if (user.id === order.userId) results.push({user, order})\n  })\n})`,
      suggestedCodeGood: `const ordersByUser = new Map(orders.map(o => [o.userId, o]))\nconst results = users.map(user => ({ user, order: ordersByUser.get(user.id) }))`,
      steps: [
        'Identify the inner loop and what it searches for',
        'Build a Map keyed by the lookup field before the outer loop',
        'Replace the inner loop with a single Map.get() call',
        'Confirm correctness with the same test data',
      ],
      estimatedFixTimeMinutes: 8,
      relatedIssues: ['STRING_CONCAT_LOOP'],
      confidence: 'HIGH',
    });

    this.rules.set('UNBOUNDED_CACHE', {
      problem: 'Unbounded Map / Set used as a cache',
      explanation: 'A Map or Set that grows without bound causes memory leaks in long-running processes. Use an LRU cache.',
      severity: 'Medium',
      currentCodeBad: `const cache = new Map()`,
      suggestedCodeGood: `import LRU from 'lru-cache'\nconst cache = new LRU({ max: 500, ttl: 1000 * 60 * 5 })`,
      steps: [
        'Determine the maximum number of entries that makes sense',
        'Replace new Map() with an LRU cache (lru-cache package)',
        'Set an appropriate TTL (time-to-live) for cached entries',
        'Monitor cache hit rate and memory usage in production',
      ],
      estimatedFixTimeMinutes: 10,
      confidence: 'MEDIUM',
    });

    // ── DevOps ────────────────────────────────────────────────────────────────

    this.rules.set('UNHANDLED_PROMISE', {
      problem: 'Promise rejection not handled — can crash the process',
      explanation: 'Unhandled rejections terminate Node.js in newer versions. Always add .catch() or use try/catch.',
      severity: 'High',
      currentCodeBad: `fetchData().then(data => process(data))`,
      suggestedCodeGood: `try {\n  const data = await fetchData()\n  process(data)\n} catch (error) {\n  logger.error('fetchData failed:', error)\n}`,
      steps: [
        'Find async operations without error handling',
        'Prefer try/catch in async functions',
        'Use .catch() for promise chains',
        'Log the error with enough context to diagnose it',
        'Decide whether to bubble up or handle locally',
      ],
      estimatedFixTimeMinutes: 5,
      relatedIssues: ['EMPTY_CATCH'],
      confidence: 'HIGH',
    });

    this.rules.set('MISSING_TIMEOUT', {
      problem: 'Network request without timeout — can hang indefinitely',
      explanation: 'Requests without timeouts stall the process when the server is slow or unreachable.',
      severity: 'High',
      currentCodeBad: `fetch(url)`,
      suggestedCodeGood: `fetch(url, { signal: AbortSignal.timeout(5000) })\n// axios: axios.get(url, { timeout: 5000 })`,
      steps: [
        'Identify all network requests in the code',
        'Add a timeout using AbortSignal.timeout(), axios timeout, or req.setTimeout()',
        'Handle the timeout error explicitly',
        'Use 5–30 s depending on the operation',
        'Log timeout events for monitoring',
      ],
      estimatedFixTimeMinutes: 3,
      confidence: 'HIGH',
    });

    this.rules.set('HARDCODED_IP', {
      problem: 'Hardcoded IP address in source code',
      explanation: 'IP addresses change between environments. Use environment variables or service discovery instead.',
      severity: 'Medium',
      currentCodeBad: `const dbHost = '192.168.1.100'`,
      suggestedCodeGood: `const dbHost = process.env.DB_HOST || 'localhost'\nif (!dbHost) throw new Error('DB_HOST required')`,
      steps: [
        'Replace the hardcoded IP with an environment variable',
        'Provide a sensible default for local development',
        'Document required environment variables in README or .env.example',
        'For Kubernetes: use service names instead of IPs',
      ],
      estimatedFixTimeMinutes: 3,
      confidence: 'HIGH',
    });

    this.rules.set('SENSITIVE_DATA_LOG', {
      problem: 'Sensitive data (passwords, tokens) written to logs',
      explanation: 'Logs are often stored centrally and accessible to many people. Never log secrets.',
      severity: 'High',
      currentCodeBad: `logger.info('User:', { email, password, token })`,
      suggestedCodeGood: `logger.info('User logged in:', { email, userId })\n// Never include password, token, or apiKey`,
      steps: [
        'Audit all logger calls for sensitive fields',
        'Remove password, token, apiKey, and secret fields',
        'Log only what is needed for diagnosis (email, userId, action)',
        'Set up log redaction / masking for sensitive fields in the logger config',
      ],
      estimatedFixTimeMinutes: 5,
      relatedIssues: ['CONSOLE_LOG', 'DEBUG_ENABLED'],
      confidence: 'HIGH',
    });
  }

  suggestFix(issueId: string, context?: SeverityContext): RemediationSuggestion | null {
    const rule = this.rules.get(issueId);
    if (!rule) return null;

    let performanceGainMs = rule.performanceGainMs;
    let estimatedFixTimeMinutes = rule.estimatedFixTimeMinutes;

    if (context?.loopIterations != null && rule.performanceGainMs != null) {
      performanceGainMs = context.loopIterations * rule.performanceGainMs;
    }

    if (context?.inTest) {
      estimatedFixTimeMinutes = Math.max(1, estimatedFixTimeMinutes - 2);
    }

    return {
      issueId,
      problem: rule.problem,
      explanation: rule.explanation,
      severity: rule.severity,
      currentCodeBad: rule.currentCodeBad,
      suggestedCodeGood: rule.suggestedCodeGood,
      steps: rule.steps,
      estimatedFixTimeMinutes,
      performanceGainMs,
      performanceGainPercent: rule.performanceGainPercent,
      envVarNeeded: rule.envVarNeeded,
      relatedIssues: rule.relatedIssues,
      confidence: rule.confidence,
    };
  }

  getAllRuleIds(): string[] {
    return Array.from(this.rules.keys());
  }

  getRulesByDomain(domain: string): string[] {
    const domainMap: Record<string, string[]> = {
      Security:    ['SQL_INJECTION', 'XSS', 'DANGEROUS_HTML', 'COMMAND_INJECTION', 'AWS_ACCESS_KEY', 'PASSWORD', 'API_KEY'],
      Quality:     ['CONSOLE_LOG', 'EMPTY_CATCH', 'TODO_FIXME', 'MAGIC_NUMBER'],
      Scalability: ['N_PLUS_ONE', 'SEQUENTIAL_ASYNC', 'NO_PAGINATION', 'NESTED_LOOP', 'UNBOUNDED_CACHE'],
      DevOps:      ['UNHANDLED_PROMISE', 'MISSING_TIMEOUT', 'HARDCODED_IP', 'SENSITIVE_DATA_LOG'],
    };
    return domainMap[domain] ?? [];
  }
}
