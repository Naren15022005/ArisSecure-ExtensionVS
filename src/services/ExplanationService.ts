export interface RemediationStep {
  order: number;
  title: string;
  description: string;
  example?: string;
}

export interface Reference {
  name: string;
  url: string;
}

export interface ExplanationData {
  what: string;
  why: string;
  risks: string[];
  standard: {
    name: string;
    cweName: string;
    owaspUrl: string;
  };
  example: {
    vulnerable: string;
    secure: string;
    docsUrl?: string;
  };
  remediation: RemediationStep[];
  references: Reference[];
}

const ORIGINAL_KB: Record<string, ExplanationData> = {
  SQL_INJECTION: {
    what: 'User input is directly concatenated into a SQL query string',
    why: 'An attacker can break out of the string and inject arbitrary SQL commands, altering query logic',
    risks: [
      'Unauthorized read/write access to the database',
      'Data exfiltration or destruction',
      'Authentication bypass (e.g. admin\'--)',
      'Full database server compromise in some configurations',
    ],
    standard: {
      name: 'OWASP A03:2021 — Injection',
      cweName: 'CWE-89: SQL Command Injection',
      owaspUrl: 'https://owasp.org/www-community/attacks/SQL_Injection',
    },
    example: {
      vulnerable: `// ❌ String concatenation — attacker controls userId
const query = "SELECT * FROM users WHERE id = " + userId;
db.execute(query);`,
      secure: `// ✅ Parameterized query — input is never parsed as SQL
const query = "SELECT * FROM users WHERE id = ?";
db.execute(query, [userId]);`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Use parameterized queries / prepared statements', description: 'Replace every string concatenation with a placeholder (?, $1, :param)' },
      { order: 2, title: 'Use an ORM (Prisma, Sequelize, TypeORM)', description: 'ORMs parameterize automatically; avoid raw() escape hatches with user input', example: 'db.user.findUnique({ where: { id: parseInt(userId) } })' },
      { order: 3, title: 'Validate and allow-list input types', description: 'If an ID must be a number, parse it and reject non-numbers before the query' },
      { order: 4, title: 'Apply least privilege to DB accounts', description: 'The app DB user should not have DROP or ALTER permissions' },
      { order: 5, title: 'Test with common SQL payloads', description: "Try: ' OR '1'='1, admin'--, 1; DROP TABLE users--" },
    ],
    references: [
      { name: 'OWASP SQL Injection', url: 'https://owasp.org/www-community/attacks/SQL_Injection' },
      { name: 'CWE-89', url: 'https://cwe.mitre.org/data/definitions/89.html' },
      { name: 'PortSwigger — SQL Injection', url: 'https://portswigger.net/web-security/sql-injection' },
    ],
  },

  EVAL_USAGE: {
    what: 'eval() or new Function() executes a string as JavaScript code at runtime',
    why: 'If the string comes from any user-controlled source, the attacker can run arbitrary code in the process',
    risks: [
      'Arbitrary code execution on the server or client',
      'Full system or application compromise',
      'Data theft, session hijacking, malware distribution',
      'Severe performance degradation (JIT de-optimization)',
    ],
    standard: {
      name: 'CWE-95 — Eval Injection',
      cweName: 'CWE-95: Improper Neutralization of Directives in Dynamically Evaluated Code',
      owaspUrl: 'https://owasp.org/www-community/attacks/Direct_Dynamic_Code_Evaluation_Eval Injection',
    },
    example: {
      vulnerable: `// ❌ eval() with any dynamic value is dangerous
const userCode = req.body.expression;
const result = eval(userCode); // RCE risk`,
      secure: `// ✅ Option 1: use JSON.parse for data
const data = JSON.parse(userInput);

// ✅ Option 2: whitelist allowed operations
const ops = { add: (a, b) => a + b, sub: (a, b) => a - b };
const result = ops[opName]?.(a, b);`,
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval!',
    },
    remediation: [
      { order: 1, title: 'Remove eval() entirely', description: 'There is almost always a safer alternative — see examples above' },
      { order: 2, title: 'Use JSON.parse() for JSON data', description: 'JSON.parse does not execute code; it only parses data structures' },
      { order: 3, title: 'Map allowed operations to real functions', description: 'Build an explicit allowlist of operations that can be invoked by name' },
      { order: 4, title: 'Use a sandboxed Worker if dynamic code is unavoidable', description: 'Node.js vm.runInNewContext() or Web Workers with no shared memory limit blast radius' },
    ],
    references: [
      { name: 'MDN — eval()', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval' },
      { name: 'CWE-95', url: 'https://cwe.mitre.org/data/definitions/95.html' },
    ],
  },

  XSS_INNER_HTML: {
    what: 'User-supplied content is written directly into the DOM via innerHTML or outerHTML',
    why: 'HTML parsed by innerHTML can contain <script> tags and event handlers that the browser will execute',
    risks: [
      'Session token theft via document.cookie',
      'Keylogging and credential harvesting',
      'Redirecting users to phishing pages',
      'Drive-by malware distribution',
    ],
    standard: {
      name: 'OWASP A03:2021 — Injection (XSS)',
      cweName: 'CWE-79: Improper Neutralization of Input During Web Page Generation',
      owaspUrl: 'https://owasp.org/www-community/attacks/xss/',
    },
    example: {
      vulnerable: `// ❌ innerHTML treats the value as HTML — scripts execute
element.innerHTML = userComment; // XSS if comment contains <script>`,
      secure: `// ✅ textContent treats value as plain text — no HTML parsing
element.textContent = userComment;

// ✅ Or sanitize with DOMPurify before inserting HTML
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userComment);`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Prefer textContent over innerHTML for plain text', description: 'textContent never parses HTML; switch if you do not need formatting' },
      { order: 2, title: 'Use DOMPurify to sanitize before inserting HTML', description: 'DOMPurify strips dangerous tags/attributes while preserving safe HTML', example: "element.innerHTML = DOMPurify.sanitize(html);" },
      { order: 3, title: 'Use framework APIs (React JSX, Vue templates)', description: 'These escape by default; only use dangerouslySetInnerHTML / v-html after explicit sanitization' },
      { order: 4, title: 'Set a strict Content-Security-Policy header', description: "CSP with 'nonce' or 'strict-dynamic' prevents inline script execution even after injection" },
    ],
    references: [
      { name: 'OWASP XSS', url: 'https://owasp.org/www-community/attacks/xss/' },
      { name: 'CWE-79', url: 'https://cwe.mitre.org/data/definitions/79.html' },
      { name: 'DOMPurify', url: 'https://github.com/cure53/DOMPurify' },
    ],
  },

  WEAK_CRYPTO: {
    what: 'MD5 or SHA-1 is used for hashing — both are cryptographically broken',
    why: 'Collision attacks make it possible to forge MD5/SHA-1 hashes; rainbow tables crack common inputs in seconds',
    risks: [
      'Password hash cracking if the DB is leaked',
      'Digital signature forgery',
      'Certificate spoofing (SHA-1 TLS certs)',
      'File integrity checks that can be bypassed',
    ],
    standard: {
      name: 'CWE-327 — Use of a Broken Cryptographic Algorithm',
      cweName: 'CWE-327: Use of a Broken or Risky Cryptographic Algorithm',
      owaspUrl: 'https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure',
    },
    example: {
      vulnerable: `// ❌ MD5 — broken, collision attacks exist since 1996
const hash = crypto.createHash('md5').update(data).digest('hex');`,
      secure: `// ✅ SHA-256 — currently safe for integrity checks
const hash = crypto.createHash('sha256').update(data).digest('hex');

// ✅ For passwords — use a slow KDF, never a raw hash
const hash = await bcrypt.hash(password, 12); // bcrypt`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Replace MD5/SHA-1 with SHA-256 or SHA-3 for integrity', description: 'crypto.createHash("sha256") is a one-line change with no API difference' },
      { order: 2, title: 'Use bcrypt, scrypt, or Argon2 for passwords', description: 'These are slow by design, making brute-force attacks infeasible', example: 'await bcrypt.hash(plaintext, 12)' },
      { order: 3, title: 'Audit all existing MD5/SHA-1 hashes in the database', description: 'If passwords were hashed with MD5, force a password reset cycle' },
    ],
    references: [
      { name: 'CWE-327', url: 'https://cwe.mitre.org/data/definitions/327.html' },
      { name: 'OWASP Password Storage', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html' },
      { name: 'NIST on Cryptographic Standards', url: 'https://csrc.nist.gov/projects/hash-functions' },
    ],
  },

  COMMAND_INJECTION: {
    what: 'A shell command is constructed with interpolated values that may come from user input',
    why: 'Shell metacharacters (;, |, &&, $()) let an attacker append or replace the intended command',
    risks: [
      'Arbitrary OS command execution as the app user',
      'File system access, destruction, or exfiltration',
      'Lateral movement within a server network',
      'Persistent backdoor installation',
    ],
    standard: {
      name: 'OWASP A03:2021 — Injection',
      cweName: 'CWE-78: Improper Neutralization of Special Elements used in an OS Command',
      owaspUrl: 'https://owasp.org/www-community/attacks/Command_Injection',
    },
    example: {
      vulnerable: `// ❌ Template literal passes user value to shell
const { stdout } = await exec(\`convert \${req.params.file} output.png\`);`,
      secure: `// ✅ Use execFile — arguments are never parsed by the shell
import { execFile } from 'child_process';
execFile('convert', [userFile, 'output.png'], callback);

// ✅ Or use a native library instead of shelling out
import sharp from 'sharp';
await sharp(userFile).toFile('output.png');`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Use execFile / spawnSync instead of exec', description: 'execFile takes cmd + args[] separately; args are never interpreted by the shell' },
      { order: 2, title: 'Avoid shelling out when a native library exists', description: 'sharp, ffmpeg.js, pdf-lib etc. handle files without spawning processes' },
      { order: 3, title: 'Allow-list valid input values', description: 'If the file must be one of a known set, validate against that set before any use' },
      { order: 4, title: 'Run processes as a dedicated low-privilege user', description: 'Contain blast radius with OS-level isolation if exec is unavoidable' },
    ],
    references: [
      { name: 'OWASP Command Injection', url: 'https://owasp.org/www-community/attacks/Command_Injection' },
      { name: 'CWE-78', url: 'https://cwe.mitre.org/data/definitions/78.html' },
    ],
  },

  INSECURE_RANDOM: {
    what: 'Math.random() generates pseudo-random numbers using a non-cryptographic algorithm',
    why: 'Its output is predictable and can be reversed-engineered, making any token it generates guessable',
    risks: [
      'Predictable session tokens enable session hijacking',
      'Guessable password-reset links allow account takeover',
      'Weak CSRF tokens can be forged',
      'Captcha bypass through output prediction',
    ],
    standard: {
      name: 'CWE-338 — Use of Cryptographically Weak PRNG',
      cweName: 'CWE-338: Use of Cryptographically Weak Pseudo-Random Number Generator',
      owaspUrl: 'https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/09-Test_File_Permission',
    },
    example: {
      vulnerable: `// ❌ Predictable — never use for security tokens
const token = Math.random().toString(36).substring(2);`,
      secure: `// ✅ Node.js — cryptographically secure random bytes
import { randomBytes } from 'crypto';
const token = randomBytes(32).toString('hex'); // 64 hex chars

// ✅ Browser — Web Crypto API
const array = new Uint8Array(32);
crypto.getRandomValues(array);`,
      docsUrl: 'https://nodejs.org/api/crypto.html#cryptorandombytessize-callback',
    },
    remediation: [
      { order: 1, title: 'Replace Math.random() with crypto.randomBytes()', description: 'Node.js crypto module is CSPRNG; no additional dependency needed' },
      { order: 2, title: 'Use uuid v4 from the uuid package for UUIDs', description: 'uuid.v4() uses crypto.randomBytes() internally', example: "import { v4 as uuidv4 } from 'uuid'; const id = uuidv4();" },
      { order: 3, title: 'Rotate any existing tokens generated with Math.random()', description: 'Assume previously issued tokens may be predictable and invalidate them' },
    ],
    references: [
      { name: 'CWE-338', url: 'https://cwe.mitre.org/data/definitions/338.html' },
      { name: 'Node.js crypto.randomBytes', url: 'https://nodejs.org/api/crypto.html#cryptorandombytessize-callback' },
    ],
  },

  PATH_TRAVERSAL: {
    what: 'A file path is built from user-supplied request data without sanitization',
    why: 'An attacker can supply ../ sequences to escape the intended directory and read/write arbitrary files',
    risks: [
      'Source code, private keys, and config files exposed',
      '.env credentials and API keys stolen',
      'Arbitrary file write leading to RCE (e.g. writing a cron job)',
      'Log tampering or evidence destruction',
    ],
    standard: {
      name: 'OWASP A01:2021 — Broken Access Control',
      cweName: 'CWE-22: Path Traversal',
      owaspUrl: 'https://owasp.org/www-community/attacks/Path_Traversal',
    },
    example: {
      vulnerable: `// ❌ Attacker sends filename = "../../etc/passwd"
const file = req.params.filename;
const data = fs.readFileSync(path.join('/uploads', file));`,
      secure: `// ✅ Resolve and validate the final path is inside the base dir
import path from 'path';
const BASE = '/uploads';
const requested = path.resolve(BASE, req.params.filename);
if (!requested.startsWith(BASE + path.sep)) {
  return res.status(400).send('Invalid path');
}
const data = fs.readFileSync(requested);`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Resolve the full path and verify it starts with the base directory', description: 'path.resolve() normalizes ../ before the startsWith check' },
      { order: 2, title: 'Store files by generated UUID, not user-supplied names', description: 'Never use the original filename for storage; generate a safe internal name' },
      { order: 3, title: 'Serve files through a stream with content-type validation', description: 'Avoid serving files from disk at all when possible; use S3/GCS signed URLs' },
    ],
    references: [
      { name: 'OWASP Path Traversal', url: 'https://owasp.org/www-community/attacks/Path_Traversal' },
      { name: 'CWE-22', url: 'https://cwe.mitre.org/data/definitions/22.html' },
    ],
  },

  // ── Secret types ────────────────────────────────────────────────────────────

  PASSWORD: {
    what: 'A plaintext password or passphrase is hardcoded directly in source code',
    why: 'Anyone with repository access — including past contributors and CI logs — can read the credential',
    risks: [
      'Credential exposed to all repository collaborators',
      'Password visible in git history forever (even after deletion)',
      'Unauthorized access to protected systems',
      'Compliance violations (SOC 2, PCI-DSS, GDPR)',
    ],
    standard: {
      name: 'CWE-798 — Use of Hard-coded Credentials',
      cweName: 'CWE-798: Use of Hard-coded Credentials',
      owaspUrl: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code',
    },
    example: {
      vulnerable: `// ❌ Hardcoded — visible to everyone with repo access
const dbPassword = "S3cr3tP@ss!";`,
      secure: `// ✅ Environment variable — value lives outside source code
const dbPassword = process.env.DB_PASSWORD;
// Add DB_PASSWORD=value to .env (git-ignored)`,
      docsUrl: 'https://12factor.net/config',
    },
    remediation: [
      { order: 1, title: 'Move the value to an environment variable', description: 'Use process.env.MY_SECRET; the actual value lives in .env or your secrets manager' },
      { order: 2, title: 'Add .env to .gitignore immediately', description: 'Run: echo ".env" >> .gitignore && git rm --cached .env (if already tracked)' },
      { order: 3, title: 'Rotate the exposed credential right now', description: 'Assume the old credential is compromised — change it in every system that uses it' },
      { order: 4, title: 'Purge it from git history', description: 'Use git-filter-repo or BFG Repo Cleaner to rewrite history and force-push', example: 'git-filter-repo --path-glob "*.env" --invert-paths' },
    ],
    references: [
      { name: 'OWASP Secrets in Code', url: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code' },
      { name: 'CWE-798', url: 'https://cwe.mitre.org/data/definitions/798.html' },
      { name: '12-Factor Config', url: 'https://12factor.net/config' },
    ],
  },

  AWS_ACCESS_KEY: {
    what: 'An AWS access key ID (AKIA…) is embedded in source code',
    why: 'AWS keys found in public repos are scraped by bots within minutes and used for crypto-mining or data theft',
    risks: [
      'Unauthorized AWS API calls billed to your account',
      'S3 data exfiltration or ransomware',
      'EC2 instances spun up for crypto-mining (thousands $/day)',
      'IAM privilege escalation to full account takeover',
    ],
    standard: {
      name: 'CWE-798 — Use of Hard-coded Credentials',
      cweName: 'CWE-798: Use of Hard-coded Credentials',
      owaspUrl: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code',
    },
    example: {
      vulnerable: `// ❌ Key in source — bots find this in under 60 seconds
const client = new S3({ accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI" });`,
      secure: `// ✅ IAM roles (EC2/Lambda) or environment variables
const client = new S3();
// AWS SDK reads from env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// Or use IAM instance roles — no keys needed at all`,
      docsUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
    },
    remediation: [
      { order: 1, title: 'Immediately revoke the exposed key in AWS IAM console', description: 'Security > Credentials > Delete key. Do this before anything else.' },
      { order: 2, title: 'Use IAM roles instead of long-term credentials', description: 'EC2, Lambda, ECS all support IAM roles — no keys needed in code or env' },
      { order: 3, title: 'Use environment variables or AWS Secrets Manager for local dev', description: 'Never commit ~/.aws/credentials — use aws configure for local profiles' },
      { order: 4, title: 'Enable AWS CloudTrail and review recent API activity', description: 'Check for unauthorized calls since the key was first committed' },
    ],
    references: [
      { name: 'AWS IAM Best Practices', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html' },
      { name: 'CWE-798', url: 'https://cwe.mitre.org/data/definitions/798.html' },
    ],
  },

  OPENAI_API_KEY: {
    what: 'An OpenAI API key (sk-…) is hardcoded in source code',
    why: 'API keys committed to any repository — even private ones — are exposed to every collaborator and CI system',
    risks: [
      'Unexpected billing charges from unauthorized usage',
      'Rate limit exhaustion blocking your own services',
      'Key revocation by OpenAI causing production outage',
    ],
    standard: {
      name: 'CWE-798 — Use of Hard-coded Credentials',
      cweName: 'CWE-798: Use of Hard-coded Credentials',
      owaspUrl: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code',
    },
    example: {
      vulnerable: `const openai = new OpenAI({ apiKey: "sk-1234567890abcdefghij" });`,
      secure: `const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// .env (git-ignored): OPENAI_API_KEY=sk-...`,
      docsUrl: 'https://platform.openai.com/docs/quickstart',
    },
    remediation: [
      { order: 1, title: 'Revoke the exposed key at platform.openai.com/api-keys', description: 'Delete and regenerate immediately — treat it as compromised' },
      { order: 2, title: 'Move to process.env.OPENAI_API_KEY', description: 'Store in .env locally; use secrets management (Vault, Doppler) in production' },
      { order: 3, title: 'Set usage limits on the OpenAI dashboard', description: 'Add a spending cap to minimize blast radius if a future leak occurs' },
    ],
    references: [
      { name: 'OpenAI API Keys', url: 'https://platform.openai.com/api-keys' },
      { name: 'CWE-798', url: 'https://cwe.mitre.org/data/definitions/798.html' },
    ],
  },

  GITHUB_TOKEN: {
    what: 'A GitHub personal access token (ghp_, gho_, ghs_, ghr_) is hardcoded in source code',
    why: 'GitHub tokens grant API access; a leaked token can be used to read private repos, push code, or modify settings',
    risks: [
      'Private repository source code exposed',
      'Malicious commits or releases pushed under your identity',
      'CI/CD pipeline manipulation',
      'Organization-wide access if the token has broad scopes',
    ],
    standard: {
      name: 'CWE-798 — Use of Hard-coded Credentials',
      cweName: 'CWE-798: Use of Hard-coded Credentials',
      owaspUrl: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code',
    },
    example: {
      vulnerable: `const octokit = new Octokit({ auth: "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz123456" });`,
      secure: `const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
// In GitHub Actions use: \${{ secrets.GITHUB_TOKEN }}`,
      docsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    },
    remediation: [
      { order: 1, title: 'Revoke the token immediately at github.com/settings/tokens', description: 'Click the token and hit Delete — it is invalidated instantly' },
      { order: 2, title: 'Use GitHub Actions secrets for CI/CD', description: "secrets.GITHUB_TOKEN is auto-provided in workflows; never hard-code a PAT" },
      { order: 3, title: 'Use fine-grained tokens with minimal scopes', description: 'New fine-grained PATs can be scoped to specific repos and permissions' },
    ],
    references: [
      { name: 'GitHub Token Security', url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens' },
      { name: 'CWE-798', url: 'https://cwe.mitre.org/data/definitions/798.html' },
    ],
  },

  GENERIC_SECRET: {
    what: 'A value assigned to a key named secret, token, or api_key is hardcoded as a string literal',
    why: 'Identifiers like "apiKey" or "secret" signal sensitive values; hardcoding them leaks credentials to anyone with code access',
    risks: [
      'Third-party API abuse billed to your account',
      'Unauthorized access to connected services',
      'Credential rotation disrupts hard-coded deployments',
    ],
    standard: {
      name: 'CWE-798 — Use of Hard-coded Credentials',
      cweName: 'CWE-798: Use of Hard-coded Credentials',
      owaspUrl: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code',
    },
    example: {
      vulnerable: `const apiKey = "a1b2c3d4e5f6g7h8i9j0";
const token  = "Bearer eyJhbGciOiJSUzI1NiJ9...";`,
      secure: `const apiKey = process.env.SERVICE_API_KEY;
const token  = process.env.SERVICE_TOKEN;`,
      docsUrl: 'https://12factor.net/config',
    },
    remediation: [
      { order: 1, title: 'Move all literal credential values to environment variables', description: 'No string literal should represent a secret — not even in tests' },
      { order: 2, title: 'Use a secrets manager for production', description: 'AWS Secrets Manager, HashiCorp Vault, or Doppler inject secrets at runtime' },
      { order: 3, title: 'Use git-secrets or truffleHog as a pre-commit hook', description: 'Prevent future accidental commits of secrets' },
    ],
    references: [
      { name: 'OWASP Secrets in Code', url: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code' },
      { name: '12-Factor Config', url: 'https://12factor.net/config' },
    ],
  },

  DB_URL: {
    what: 'A database connection URL containing embedded credentials is hardcoded in source code',
    why: 'Connection strings like mongodb://user:pass@host encode both the password and server address in one string',
    risks: [
      'Database credentials exposed to all code readers',
      'Direct database access from attacker\'s machine if the DB is internet-accessible',
      'Data breach or destruction',
    ],
    standard: {
      name: 'CWE-798 — Use of Hard-coded Credentials',
      cweName: 'CWE-798: Use of Hard-coded Credentials',
      owaspUrl: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code',
    },
    example: {
      vulnerable: `const conn = "mongodb://admin:p@ssw0rd@db.prod.example.com:27017/mydb";`,
      secure: `const conn = process.env.DATABASE_URL;
// .env: DATABASE_URL=mongodb://admin:p@ssw0rd@localhost:27017/mydb`,
      docsUrl: 'https://12factor.net/backing-services',
    },
    remediation: [
      { order: 1, title: 'Move DATABASE_URL to an environment variable', description: 'Most frameworks (Prisma, TypeORM, Mongoose) read this from the environment by convention' },
      { order: 2, title: 'Change the database password immediately', description: 'The embedded password is compromised — rotate it in the DB and update the env var' },
      { order: 3, title: 'Restrict DB network access to application servers only', description: 'Use VPC/firewall rules so the DB is never internet-accessible' },
    ],
    references: [
      { name: '12-Factor Backing Services', url: 'https://12factor.net/backing-services' },
      { name: 'CWE-798', url: 'https://cwe.mitre.org/data/definitions/798.html' },
    ],
  },

  PRIVATE_KEY: {
    what: 'A PEM-encoded private key (RSA, EC, or SSH) is embedded in source code',
    why: 'Private keys must remain secret; once in source control they are effectively public even if the repo is later made private',
    risks: [
      'TLS certificate impersonation (MITM attacks)',
      'JWT forgery if used as a signing key',
      'SSH access to servers that trust the public key counterpart',
      'Cannot be revoked without replacing every dependent system',
    ],
    standard: {
      name: 'CWE-321 — Use of Hard-coded Cryptographic Key',
      cweName: 'CWE-321: Use of Hard-coded Cryptographic Key',
      owaspUrl: 'https://owasp.org/www-community/vulnerabilities/Secrets_in_Code',
    },
    example: {
      vulnerable: `const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3...
-----END RSA PRIVATE KEY-----\`;`,
      secure: `// ✅ Read from filesystem path (outside repo) or env var
import fs from 'fs';
const privateKey = process.env.PRIVATE_KEY_PEM
  ?? fs.readFileSync('/run/secrets/private.key', 'utf8');`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Revoke / replace the key immediately', description: 'For TLS: reissue the certificate. For SSH: remove the public key from authorized_keys.' },
      { order: 2, title: 'Store PEM content as a secret in your secrets manager', description: 'Inject via env var or mounted secret file at runtime — never in source' },
      { order: 3, title: 'Use hardware key storage for production (HSM / cloud KMS)', description: 'AWS KMS, GCP Cloud KMS, or Azure Key Vault — private key never leaves the HSM' },
    ],
    references: [
      { name: 'OWASP Cryptographic Storage', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html' },
      { name: 'CWE-321', url: 'https://cwe.mitre.org/data/definitions/321.html' },
    ],
  },
};

// ── Security — Advanced patterns ────────────────────────────────────────────

const SECURITY_ADVANCED: Record<string, ExplanationData> = {
  NOSQL_INJECTION: {
    what: 'User-controlled data is passed directly into a NoSQL query operator',
    why: 'MongoDB operators like $where or $regex can be injected to bypass query logic or dump data',
    risks: ['Authentication bypass via operator injection', 'Full collection data exfiltration', 'Denial of service via $where with infinite loop'],
    standard: { name: 'OWASP A03:2021 — Injection', cweName: 'CWE-943: NoSQL Injection', owaspUrl: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05.6-Testing_for_NoSQL_Injection' },
    example: {
      vulnerable: `User.findOne({ username: req.body.username });
// Attacker sends: { "$gt": "" } — returns first user`,
      secure: `const { username } = req.body;
if (typeof username !== 'string') return res.status(400).end();
User.findOne({ username });`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Validate input types before using in queries', description: 'Ensure inputs are the expected primitive type (string, number), not objects' },
      { order: 2, title: 'Use an ODM (Mongoose) with schema validation', description: 'Mongoose schemas cast and sanitize inputs before they reach the driver' },
      { order: 3, title: 'Never use $where or mapReduce with user data', description: '$where executes arbitrary JavaScript on the server' },
    ],
    references: [{ name: 'OWASP NoSQL Injection', url: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05.6-Testing_for_NoSQL_Injection' }, { name: 'CWE-943', url: 'https://cwe.mitre.org/data/definitions/943.html' }],
  },

  JWT_INSECURE: {
    what: 'jwt.decode() is used instead of jwt.verify(), skipping signature validation',
    why: 'decode() never checks the signature — an attacker can forge any payload',
    risks: ['Authentication bypass with forged tokens', 'Privilege escalation by changing role claim', 'Identity impersonation'],
    standard: { name: 'CWE-347 — Improper Verification of Cryptographic Signature', cweName: 'CWE-347', owaspUrl: 'https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/06-Session_Management_Testing/10-Testing_JSON_Web_Tokens' },
    example: {
      vulnerable: `const payload = jwt.decode(token);  // No signature check!
const userId = payload.sub;`,
      secure: `const payload = jwt.verify(token, process.env.JWT_SECRET);
const userId = (payload as JwtPayload).sub;`,
      docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html',
    },
    remediation: [
      { order: 1, title: 'Replace jwt.decode() with jwt.verify()', description: 'verify() validates the signature and expiry; decode() only base64-decodes the payload' },
      { order: 2, title: 'Store JWT secret in env var, minimum 256 bits', description: 'Use crypto.randomBytes(32).toString("hex") to generate a strong secret' },
      { order: 3, title: 'Set short expiry and refresh token rotation', description: 'expiresIn: "15m" with refresh tokens limits the blast radius of a stolen token' },
    ],
    references: [{ name: 'JWT Security Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html' }, { name: 'CWE-347', url: 'https://cwe.mitre.org/data/definitions/347.html' }],
  },

  DEBUG_ENABLED: {
    what: 'Debug mode or verbose error output is hardcoded to be enabled',
    why: 'Debug mode exposes stack traces, internals, and configuration to end users',
    risks: ['Internal path and module structure exposed', 'Database schema leaked in error messages', 'Sensitive config values visible in traces'],
    standard: { name: 'OWASP A05:2021 — Security Misconfiguration', cweName: 'CWE-489: Active Debug Code', owaspUrl: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/' },
    example: {
      vulnerable: `app.set('debug', true);
app.use(morgan('dev'));  // Detailed logging always on`,
      secure: `app.set('debug', process.env.DEBUG === 'true');
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}`,
    },
    remediation: [
      { order: 1, title: 'Gate all debug settings on NODE_ENV or DEBUG env var', description: 'Never hardcode true for debug flags' },
      { order: 2, title: 'Return generic error messages in production', description: 'Use middleware to catch errors and return {"error":"Internal Server Error"} only' },
      { order: 3, title: 'Use structured logging (Winston, Pino) with level control', description: 'Set LOG_LEVEL=error in production, info in staging' },
    ],
    references: [{ name: 'OWASP A05 Misconfiguration', url: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/' }, { name: 'CWE-489', url: 'https://cwe.mitre.org/data/definitions/489.html' }],
  },

  PROTOTYPE_POLLUTION: {
    what: 'User-supplied object is merged into another without key sanitization, allowing __proto__ injection',
    why: 'Setting __proto__ modifies the global Object prototype, affecting every object in the runtime',
    risks: ['Remote code execution in some Node.js versions', 'Application logic bypass', 'Denial of service via property corruption'],
    standard: { name: 'CWE-1321 — Prototype Pollution', cweName: 'CWE-1321', owaspUrl: 'https://portswigger.net/web-security/prototype-pollution' },
    example: {
      vulnerable: `Object.assign(config, req.body);
// Attacker: {"__proto__":{"isAdmin":true}}`,
      secure: `import { merge } from 'lodash';
const safe = JSON.parse(JSON.stringify(req.body));
merge({}, safe);  // lodash >=4.17.21 blocks __proto__`,
    },
    remediation: [
      { order: 1, title: 'Sanitize keys before merge — reject __proto__, constructor, prototype', description: 'Check every key before recursive merge' },
      { order: 2, title: 'Use Object.create(null) for config objects', description: 'null-prototype objects are immune to prototype pollution' },
      { order: 3, title: 'Use JSON Schema validation on all incoming objects', description: 'Reject unexpected keys at the API boundary' },
    ],
    references: [{ name: 'PortSwigger Prototype Pollution', url: 'https://portswigger.net/web-security/prototype-pollution' }, { name: 'CWE-1321', url: 'https://cwe.mitre.org/data/definitions/1321.html' }],
  },

  SSRF: {
    what: 'A user-controlled URL is passed to a server-side HTTP request without validation',
    why: 'The server makes requests on behalf of the attacker, accessing internal services or cloud metadata',
    risks: ['Access to cloud instance metadata (AWS: 169.254.169.254)', 'Internal network scanning', 'Read internal-only services (databases, admin panels)'],
    standard: { name: 'OWASP A10:2021 — Server-Side Request Forgery', cweName: 'CWE-918', owaspUrl: 'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/' },
    example: {
      vulnerable: `const url = req.query.imageUrl;
const response = await fetch(url);  // Attacker: http://169.254.169.254/latest/meta-data/`,
      secure: `import { URL } from 'url';
const allowed = ['https://images.example.com'];
const parsed = new URL(req.query.imageUrl);
if (!allowed.some(a => parsed.origin === a)) throw new Error('Forbidden');
const response = await fetch(parsed.toString());`,
    },
    remediation: [
      { order: 1, title: 'Validate URL against an allowlist of domains/origins', description: 'Never allow arbitrary URLs — define which origins are permitted' },
      { order: 2, title: 'Resolve DNS before making the request, block private IPs', description: 'Block 10.x, 172.16.x, 192.168.x, 169.254.x, ::1' },
      { order: 3, title: 'Use a dedicated outbound proxy with access controls', description: 'Route all external requests through a proxy that enforces the allowlist' },
    ],
    references: [{ name: 'OWASP SSRF', url: 'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/' }, { name: 'CWE-918', url: 'https://cwe.mitre.org/data/definitions/918.html' }],
  },

  CORS_ALL_ORIGINS: {
    what: 'CORS is configured with wildcard (*) allowing any origin to make credentialed requests',
    why: 'Any website can read responses from your API on behalf of a logged-in user',
    risks: ['Cross-origin data theft', 'CSRF-like attacks without tokens', 'Sensitive API exposed to hostile sites'],
    standard: { name: 'OWASP A05:2021 — Security Misconfiguration', cweName: 'CWE-942: Overly Permissive CORS Policy', owaspUrl: 'https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny' },
    example: {
      vulnerable: `app.use(cors({ origin: '*' }));`,
      secure: `const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',');
app.use(cors({
  origin: (o, cb) => cb(null, allowedOrigins.includes(o ?? '')),
  credentials: true,
}));`,
    },
    remediation: [
      { order: 1, title: 'Specify an explicit allowlist of trusted origins', description: 'Use an environment variable: ALLOWED_ORIGINS=https://app.example.com' },
      { order: 2, title: 'Never combine * with credentials: true', description: 'Browsers block this combination, but the intent itself is dangerous' },
    ],
    references: [{ name: 'OWASP CORS', url: 'https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny' }, { name: 'CWE-942', url: 'https://cwe.mitre.org/data/definitions/942.html' }],
  },

  COOKIE_INSECURE: {
    what: 'A session or authentication cookie is set without httpOnly and/or secure flags',
    why: 'Without httpOnly, XSS can steal the cookie; without secure, it travels over plain HTTP',
    risks: ['Session hijacking via XSS', 'Cookie theft over network (coffee-shop MITM)', 'Persistent session after logout'],
    standard: { name: 'CWE-614 — Sensitive Cookie Without Secure Flag', cweName: 'CWE-614 / CWE-1004', owaspUrl: 'https://owasp.org/www-community/controls/SecureCookieAttribute' },
    example: {
      vulnerable: `res.cookie('session', token);`,
      secure: `res.cookie('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,
});`,
    },
    remediation: [
      { order: 1, title: 'Always set httpOnly: true on session cookies', description: 'httpOnly prevents JavaScript from reading the cookie at all' },
      { order: 2, title: 'Set secure: true in production (HTTPS only)', description: 'Gate on NODE_ENV to allow local HTTP dev' },
      { order: 3, title: 'Set sameSite: "strict" or "lax" to prevent CSRF', description: 'strict blocks the cookie in all cross-site requests' },
    ],
    references: [{ name: 'OWASP Secure Cookie', url: 'https://owasp.org/www-community/controls/SecureCookieAttribute' }, { name: 'CWE-614', url: 'https://cwe.mitre.org/data/definitions/614.html' }],
  },

  OPEN_REDIRECT: {
    what: 'A redirect URL is taken directly from user input without validation',
    why: 'Attackers craft links to your trusted domain that redirect to phishing sites',
    risks: ['Phishing attacks using your domain\'s trust', 'OAuth token theft via redirect_uri manipulation', 'User credential harvesting'],
    standard: { name: 'CWE-601 — URL Redirection to Untrusted Site', cweName: 'CWE-601: Open Redirect', owaspUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html' },
    example: {
      vulnerable: `res.redirect(req.query.next);`,
      secure: `const next = req.query.next ?? '/dashboard';
const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
res.redirect(safe);`,
    },
    remediation: [
      { order: 1, title: 'Only allow relative paths (starting with /)', description: 'Absolute URLs and protocol-relative URLs (//) should be rejected' },
      { order: 2, title: 'Maintain an allowlist of permitted redirect URLs', description: 'For OAuth: validate redirect_uri against pre-registered URIs' },
    ],
    references: [{ name: 'OWASP Open Redirect', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html' }, { name: 'CWE-601', url: 'https://cwe.mitre.org/data/definitions/601.html' }],
  },

  SENSITIVE_DATA_LOG: {
    what: 'A password, token, or other credential is being printed to the console or log',
    why: 'Log files are often stored unencrypted, sent to third-party services, and retained for months',
    risks: ['Credentials exposed in log aggregation systems (Datadog, Splunk)', 'Log files readable by operations staff', 'Credential theft from log backups'],
    standard: { name: 'OWASP A09:2021 — Security Logging Failures', cweName: 'CWE-532: Insertion of Sensitive Information into Log File', owaspUrl: 'https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/' },
    example: {
      vulnerable: `console.log('Login attempt:', username, password);
logger.debug({ user, token });`,
      secure: `console.log('Login attempt:', username);  // password omitted
logger.debug({ userId: user.id });  // token omitted`,
    },
    remediation: [
      { order: 1, title: 'Never log passwords, tokens, keys, or PII', description: 'Audit every log call — if in doubt, omit the field' },
      { order: 2, title: 'Use a log sanitizer middleware', description: 'Libraries like pino-noir can redact fields by key name automatically' },
      { order: 3, title: 'Encrypt log storage and restrict access', description: 'Logs should be treated as sensitive data' },
    ],
    references: [{ name: 'OWASP Logging', url: 'https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/' }, { name: 'CWE-532', url: 'https://cwe.mitre.org/data/definitions/532.html' }],
  },

  DANGEROUS_HTML: {
    what: 'dangerouslySetInnerHTML is used in React without sanitization',
    why: 'React\'s safety mechanism is deliberately bypassed, allowing raw HTML — including scripts — to execute',
    risks: ['Cross-site scripting (XSS) in React apps', 'Session hijacking', 'Credential theft via injected keylogger'],
    standard: { name: 'OWASP A03:2021 — Injection (XSS)', cweName: 'CWE-79: Cross-site Scripting', owaspUrl: 'https://owasp.org/www-community/attacks/xss/' },
    example: {
      vulnerable: `<div dangerouslySetInnerHTML={{ __html: userComment }} />`,
      secure: `import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userComment) }} />
// Or use a Markdown renderer that escapes HTML by default`,
    },
    remediation: [
      { order: 1, title: 'Sanitize with DOMPurify before dangerouslySetInnerHTML', description: 'DOMPurify removes all dangerous HTML while keeping safe formatting' },
      { order: 2, title: 'Prefer text rendering or a safe Markdown library', description: 'react-markdown with no dangerouslySetInnerHTML is safer for user content' },
    ],
    references: [{ name: 'React dangerouslySetInnerHTML', url: 'https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html' }, { name: 'DOMPurify', url: 'https://github.com/cure53/DOMPurify' }],
  },
};

// ── Code Quality patterns ────────────────────────────────────────────────────

const QUALITY_KB: Record<string, ExplanationData> = {
  LONG_FUNCTION: {
    what: 'A function or method spans many lines, indicating multiple responsibilities',
    why: 'Long functions are hard to test, understand, and maintain — each change risks breaking other behavior',
    risks: ['High bug density', 'Low test coverage', 'Resistance to refactoring'],
    standard: { name: 'Clean Code — Single Responsibility Principle', cweName: 'SRP (Robert C. Martin)', owaspUrl: 'https://en.wikipedia.org/wiki/Single-responsibility_principle' },
    example: {
      vulnerable: `function processOrder(order) {
  // validate... 20 lines
  // calculate price... 20 lines
  // send email... 20 lines
  // update database... 20 lines
}`,
      secure: `function processOrder(order) {
  validateOrder(order);
  const price = calculatePrice(order);
  await updateDatabase(order, price);
  await sendConfirmationEmail(order, price);
}`,
    },
    remediation: [
      { order: 1, title: 'Identify distinct responsibilities in the function', description: 'Each comment block is usually a candidate for extraction' },
      { order: 2, title: 'Extract sub-functions with descriptive names', description: 'The function body becomes a readable summary of steps' },
      { order: 3, title: 'Target < 20 lines per function', description: 'Functions that fit on one screen are easiest to understand and test' },
    ],
    references: [{ name: 'Clean Code', url: 'https://www.goodreads.com/book/show/3735293-clean-code' }, { name: 'Refactoring — Extract Method', url: 'https://refactoring.com/catalog/extractFunction.html' }],
  },

  TOO_MANY_PARAMS: {
    what: 'A function accepts many parameters, making call sites hard to read and maintain',
    why: 'Long parameter lists signal a function doing too much and are error-prone (easy to swap arguments)',
    risks: ['Arguments passed in wrong order (silent bug)', 'Adding a new param breaks all callers', 'Difficult to provide defaults'],
    standard: { name: 'Clean Code — Function Arguments', cweName: 'Refactoring: Introduce Parameter Object', owaspUrl: 'https://refactoring.com/catalog/introduceParameterObject.html' },
    example: {
      vulnerable: `function createUser(name, email, phone, address, role, verified, sendEmail) { ... }`,
      secure: `interface CreateUserDTO {
  name: string; email: string; phone?: string;
  address?: string; role: Role; verified?: boolean; sendEmail?: boolean;
}
function createUser(dto: CreateUserDTO) { ... }`,
    },
    remediation: [
      { order: 1, title: 'Group related parameters into an object (DTO)', description: 'TypeScript interfaces make the shape explicit and self-documenting' },
      { order: 2, title: 'Use default values for optional fields in the object', description: 'function createUser({ sendEmail = true, ...rest }: DTO) { }' },
    ],
    references: [{ name: 'Introduce Parameter Object', url: 'https://refactoring.com/catalog/introduceParameterObject.html' }, { name: 'Clean Code — Chapter 3', url: 'https://www.goodreads.com/book/show/3735293-clean-code' }],
  },

  MAGIC_NUMBER: {
    what: 'A numeric literal is used directly in logic without a named constant explaining its meaning',
    why: 'The number\'s purpose is invisible to future readers, making changes error-prone',
    risks: ['Same number repeated in multiple places — miss one during updates', 'Business rule buried in implementation', 'No single source of truth for the value'],
    standard: { name: 'Clean Code — Meaningful Names', cweName: 'Avoid Magic Numbers (Martin Fowler)', owaspUrl: 'https://refactoring.com/catalog/replaceMagicLiteral.html' },
    example: {
      vulnerable: `if (user.age < 18) throw new Error('Forbidden');
if (password.length < 8) throw new Error('Too short');`,
      secure: `const MINIMUM_AGE = 18;
const MINIMUM_PASSWORD_LENGTH = 8;
if (user.age < MINIMUM_AGE) throw new Error('Forbidden');
if (password.length < MINIMUM_PASSWORD_LENGTH) throw new Error('Too short');`,
    },
    remediation: [
      { order: 1, title: 'Extract numeric literal to a named constant', description: 'const MAX_RETRY_ATTEMPTS = 3; — the name explains the business rule' },
      { order: 2, title: 'Place constants at the top of the module or in a constants.ts', description: 'Single source of truth makes updates safe' },
    ],
    references: [{ name: 'Replace Magic Literal', url: 'https://refactoring.com/catalog/replaceMagicLiteral.html' }],
  },

  EMPTY_CATCH: {
    what: 'An exception is caught and silently discarded — no logging, no re-throw, no handling',
    why: 'Errors disappear without trace, making debugging nearly impossible in production',
    risks: ['Silent data corruption', 'Failed operations reported as success', 'Hours of debugging missing errors'],
    standard: { name: 'Clean Code — Error Handling', cweName: 'CWE-390: Detection of Error Condition Without Action', owaspUrl: 'https://cwe.mitre.org/data/definitions/390.html' },
    example: {
      vulnerable: `try {
  await db.save(record);
} catch (e) {
  // TODO: handle this
}`,
      secure: `try {
  await db.save(record);
} catch (error) {
  logger.error('Failed to save record', { id: record.id, error });
  throw new DatabaseError('Save failed', { cause: error });
}`,
    },
    remediation: [
      { order: 1, title: 'At minimum, log the error with context', description: 'logger.error("Operation failed", { error, context }) gives a trace to follow' },
      { order: 2, title: 'Decide: recover, retry, or rethrow', description: 'Empty catch = the error never happened. That is almost never correct.' },
    ],
    references: [{ name: 'CWE-390', url: 'https://cwe.mitre.org/data/definitions/390.html' }, { name: 'Clean Code Error Handling', url: 'https://www.goodreads.com/book/show/3735293-clean-code' }],
  },

  CONSOLE_LOG: {
    what: 'console.log or console.debug is used for application logging in production code',
    why: 'console.* has no log levels, no timestamps, no structured output, and blocks the event loop on some platforms',
    risks: ['Sensitive data leaked to console in production', 'No log level control (can\'t silence in prod)', 'Structured log systems (Datadog, ELK) can\'t parse unstructured output'],
    standard: { name: 'Clean Code — Logging Best Practices', cweName: 'Best Practice: Use a logger library', owaspUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html' },
    example: {
      vulnerable: `console.log('User logged in:', userId, token);`,
      secure: `import { logger } from './logger';
logger.info('User logged in', { userId });  // token excluded`,
    },
    remediation: [
      { order: 1, title: 'Replace console.* with a structured logger (Winston, Pino)', description: 'One-line setup: import { logger } from "./logger"' },
      { order: 2, title: 'Set LOG_LEVEL=warn in production', description: 'Suppress debug noise in prod while keeping warnings and errors' },
    ],
    references: [{ name: 'OWASP Logging Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html' }],
  },

  TODO_FIXME: {
    what: 'A TODO, FIXME, or HACK comment marks incomplete or workaround code',
    why: 'These comments indicate known problems that get forgotten in backlogs — they become permanent',
    risks: ['Known bugs shipped to production', 'Technical debt accumulating invisibly', 'Security issues marked as TODO and never fixed'],
    standard: { name: 'Clean Code — Comments', cweName: 'Refactoring: Known Issue Left Unaddressed', owaspUrl: 'https://en.wikipedia.org/wiki/Technical_debt' },
    example: {
      vulnerable: `// FIXME: SQL injection possible here
// TODO: validate user input
// HACK: this works but needs proper fix`,
      secure: `// If it's a quick fix: fix it now
// If it's large: create a tracked ticket with the comment referencing it
// // TODO: see JIRA-1234 — validate input before DB query`,
    },
    remediation: [
      { order: 1, title: 'Fix simple TODOs immediately — they take < 5 minutes', description: 'If it takes 5 minutes, do it now. If not, track it properly.' },
      { order: 2, title: 'Convert big FIXMEs into tracked issues', description: 'Update the comment: "see JIRA-1234" so it\'s not forgotten' },
    ],
    references: [{ name: 'Technical Debt', url: 'https://martinfowler.com/bliki/TechnicalDebt.html' }],
  },

  DEEP_NESTING: {
    what: 'Code is indented 4 or more levels deep, indicating complex conditional logic',
    why: 'Deeply nested code is hard to follow, test, and refactor without introducing bugs',
    risks: ['High cyclomatic complexity — many possible execution paths', 'Hard to write tests for all branches', 'Logic buried in the middle of nesting'],
    standard: { name: 'Clean Code — Structured Programming', cweName: 'Refactoring: Replace Nested Conditional with Guard Clauses', owaspUrl: 'https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html' },
    example: {
      vulnerable: `if (user) {
  if (user.isActive) {
    if (user.hasPermission('read')) {
      if (resource) {
        return resource.getData();
      }
    }
  }
}`,
      secure: `if (!user || !user.isActive) return null;
if (!user.hasPermission('read')) throw new ForbiddenError();
if (!resource) return null;
return resource.getData();`,
    },
    remediation: [
      { order: 1, title: 'Use early returns (guard clauses) to invert conditions', description: 'Return or throw for invalid states early; happy path stays at the left margin' },
      { order: 2, title: 'Extract complex conditions into named functions', description: 'isUserAuthorized(user, resource) reads like a sentence' },
    ],
    references: [{ name: 'Replace Nested Conditional with Guard Clauses', url: 'https://refactoring.com/catalog/replaceNestedConditionalWithGuardClauses.html' }],
  },

  POOR_NAMING: {
    what: 'Variables or functions have single-character or cryptic names',
    why: 'Code is read 10x more than it is written — poor names force every reader to reverse-engineer intent',
    risks: ['Maintenance errors from misunderstood purpose', 'Longer onboarding for new developers', 'Bug-prone refactoring due to unclear scope'],
    standard: { name: 'Clean Code — Meaningful Names', cweName: 'Best Practice: Intention-Revealing Names', owaspUrl: 'https://www.goodreads.com/book/show/3735293-clean-code' },
    example: {
      vulnerable: `function process(d) {
  let x = d.length;
  let tmp = d.filter(u => u.a > 0);
  return tmp;
}`,
      secure: `function filterActiveUsers(users: User[]): User[] {
  const minimumAge = 0;
  return users.filter(user => user.age > minimumAge);
}`,
    },
    remediation: [
      { order: 1, title: 'Use intention-revealing names: what does this hold?', description: 'data → userList, d → document, x → totalCount' },
      { order: 2, title: 'Functions should describe what they DO', description: 'process → validateAndSortUsers, calc → calculateTax' },
    ],
    references: [{ name: 'Clean Code — Chapter 2', url: 'https://www.goodreads.com/book/show/3735293-clean-code' }],
  },
};

// ── DevOps patterns ──────────────────────────────────────────────────────────

const DEVOPS_KB: Record<string, ExplanationData> = {
  HARDCODED_IP: {
    what: 'An IP address or hostname is hardcoded directly in application code',
    why: 'Infrastructure changes (migration, scaling, DR) require code changes and redeployment',
    risks: ['Zero-downtime deployment impossible', 'Different environments need different builds', 'IP addresses in source code expose network topology'],
    standard: { name: '12-Factor App — Config', cweName: 'Best Practice: Externalize Config', owaspUrl: 'https://12factor.net/config' },
    example: {
      vulnerable: `const dbHost = '192.168.1.100';
const cacheUrl = 'redis://10.0.0.5:6379';`,
      secure: `const dbHost = process.env.DB_HOST ?? 'localhost';
const cacheUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';`,
    },
    remediation: [
      { order: 1, title: 'Move all IPs and hostnames to environment variables', description: 'DB_HOST, REDIS_URL, API_BASE_URL — never hardcode' },
      { order: 2, title: 'Use service discovery for dynamic infrastructures', description: 'Kubernetes services, Consul, or AWS service endpoints resolve at runtime' },
    ],
    references: [{ name: '12-Factor Config', url: 'https://12factor.net/config' }],
  },

  MISSING_TIMEOUT: {
    what: 'An HTTP request or I/O operation has no timeout configured',
    why: 'Without a timeout, a slow or unresponsive dependency stalls the request indefinitely',
    risks: ['Server thread/connection pool exhausted by hanging requests', 'Cascading failures when one dependency is slow', 'Memory leaks from pending promises'],
    standard: { name: 'Resilience Engineering — Timeouts, Retries, Circuit Breakers', cweName: 'Best Practice: Fail Fast', owaspUrl: 'https://docs.aws.amazon.com/general/latest/gr/api-retries.html' },
    example: {
      vulnerable: `const response = await fetch(url);`,
      secure: `const controller = new AbortController();
const timer = globalThis.setTimeout(() => controller.abort(), 5_000);
try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  globalThis.clearTimeout(timer);
}`,
    },
    remediation: [
      { order: 1, title: 'Set explicit timeouts on all outbound network calls', description: 'axios: { timeout: 5000 } — fetch: AbortSignal.timeout(5000)' },
      { order: 2, title: 'Add circuit breakers for critical dependencies', description: 'opossum or cockatiel implement circuit-breaker pattern for Node.js' },
    ],
    references: [{ name: 'AWS Timeout Best Practices', url: 'https://docs.aws.amazon.com/general/latest/gr/api-retries.html' }, { name: 'Circuit Breaker Pattern', url: 'https://martinfowler.com/bliki/CircuitBreaker.html' }],
  },

  UNHANDLED_PROMISE: {
    what: 'A Promise chain uses .then() without a .catch(), leaving rejections unhandled',
    why: 'Unhandled rejections silently fail and can crash Node.js or be swallowed by frameworks',
    risks: ['Silent failures that appear as success', 'UnhandledPromiseRejectionWarning crashing the process in newer Node.js', 'Hard-to-reproduce production bugs'],
    standard: { name: 'Node.js Best Practices — Error Handling', cweName: 'CWE-390: Detection of Error Without Action', owaspUrl: 'https://github.com/goldbergyoni/nodebestpractices#2-error-handling-practices' },
    example: {
      vulnerable: `fetchUser(id).then(user => dashboard.render(user));`,
      secure: `fetchUser(id)
  .then(user => dashboard.render(user))
  .catch(error => {
    logger.error('Failed to fetch user', { id, error });
    dashboard.renderError();
  });
// Or with async/await:
try {
  const user = await fetchUser(id);
  dashboard.render(user);
} catch (error) {
  logger.error('Failed to fetch user', { id, error });
}`,
    },
    remediation: [
      { order: 1, title: 'Always add .catch() to promise chains', description: 'Every .then() should have a corresponding .catch()' },
      { order: 2, title: 'Prefer async/await with try/catch for clarity', description: 'Error flow is explicit and matches synchronous code structure' },
    ],
    references: [{ name: 'Node.js Best Practices', url: 'https://github.com/goldbergyoni/nodebestpractices' }],
  },

  PROCESS_EXIT: {
    what: 'process.exit() is called inside application logic instead of allowing graceful shutdown',
    why: 'process.exit() kills the process immediately — in-flight requests are dropped and resources are not cleaned up',
    risks: ['In-flight HTTP requests dropped (data loss)', 'Database transactions not committed or rolled back', 'Kubernetes pod restart loops'],
    standard: { name: 'DevOps — Graceful Shutdown', cweName: 'Best Practice: SIGTERM Handler', owaspUrl: 'https://github.com/goldbergyoni/nodebestpractices#handling-errors' },
    example: {
      vulnerable: `if (!config.dbUrl) {
  console.error('Missing DB_URL');
  process.exit(1);
}`,
      secure: `if (!config.dbUrl) {
  logger.fatal('Missing DB_URL — cannot start');
  // Throw during startup (before server.listen) — process exits naturally
  throw new Error('Missing required config: DB_URL');
}
// For runtime shutdown:
process.on('SIGTERM', async () => {
  await server.close();
  await db.disconnect();
  process.exit(0);
});`,
    },
    remediation: [
      { order: 1, title: 'Throw errors during startup — they propagate naturally', description: 'The process will exit with the uncaught exception; stack trace is visible' },
      { order: 2, title: 'Handle SIGTERM with graceful shutdown sequence', description: 'Stop accepting new connections, finish in-flight requests, then exit' },
    ],
    references: [{ name: 'Node.js Graceful Shutdown', url: 'https://github.com/goldbergyoni/nodebestpractices' }],
  },

  SYNC_FILE_IN_SERVER: {
    what: 'A synchronous file system operation (readFileSync, writeFileSync) is used in request-handling code',
    why: 'Synchronous I/O blocks the Node.js event loop — all concurrent requests are frozen until the disk operation completes',
    risks: ['P99 latency spikes when disk is slow', 'Server becomes unresponsive under load', 'One slow file operation blocks the entire application'],
    standard: { name: 'Node.js Best Practices — Async I/O', cweName: 'Best Practice: Never block the event loop', owaspUrl: 'https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop' },
    example: {
      vulnerable: `app.get('/report', (req, res) => {
  const data = fs.readFileSync('/var/data/report.csv');  // Blocks!
  res.send(data);
});`,
      secure: `app.get('/report', async (req, res) => {
  const data = await fs.promises.readFile('/var/data/report.csv');
  res.send(data);
  // Or stream it:
  fs.createReadStream('/var/data/report.csv').pipe(res);
});`,
    },
    remediation: [
      { order: 1, title: 'Replace readFileSync/writeFileSync with fs.promises.*', description: 'await fs.promises.readFile() is drop-in with proper async handling' },
      { order: 2, title: 'Use streams for large files', description: 'fs.createReadStream().pipe(res) avoids loading the entire file into memory' },
    ],
    references: [{ name: 'Node.js: Don\'t Block the Event Loop', url: 'https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop' }],
  },

  NO_INPUT_VALIDATION: {
    what: 'req.body or req.params values are used directly without schema validation',
    why: 'Without validation, the application must trust the client — any shape, type, or size of data can arrive',
    risks: ['Type coercion bugs (undefined treated as string)', 'Oversized payloads causing memory exhaustion', 'Missing fields causing runtime errors'],
    standard: { name: 'OWASP A03:2021 — Injection', cweName: 'CWE-20: Improper Input Validation', owaspUrl: 'https://owasp.org/www-community/controls/Input_Validation_Cheat_Sheet' },
    example: {
      vulnerable: `app.post('/user', (req, res) => {
  const { name, email } = req.body;
  db.createUser(name, email);
});`,
      secure: `import { z } from 'zod';
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});
app.post('/user', (req, res) => {
  const { name, email } = schema.parse(req.body);
  db.createUser(name, email);
});`,
    },
    remediation: [
      { order: 1, title: 'Validate every incoming request with Zod, Joi, or express-validator', description: 'Define the exact shape, types, and ranges you expect' },
      { order: 2, title: 'Return 400 Bad Request on validation failure with field details', description: 'Let callers know exactly what was wrong so they can fix it' },
    ],
    references: [{ name: 'OWASP Input Validation', url: 'https://owasp.org/www-community/controls/Input_Validation_Cheat_Sheet' }, { name: 'Zod', url: 'https://zod.dev' }],
  },
};

// ── Scalability patterns ─────────────────────────────────────────────────────

const SCALABILITY_KB: Record<string, ExplanationData> = {
  N_PLUS_ONE: {
    what: 'A database or API query is executed inside a loop — one query per item',
    why: 'With N items, you make N+1 queries instead of 2: one extra query per item added multiplies latency linearly',
    risks: ['100ms × 1000 rows = 100 seconds page load', 'Database connection pool exhausted', 'Cascading timeout failures under load'],
    standard: { name: 'Database Performance — Batch Loading', cweName: 'N+1 Query Anti-pattern', owaspUrl: 'https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance' },
    example: {
      vulnerable: `// 1 query per user — 1000 users = 1001 DB calls
for (const user of users) {
  user.orders = await db.query('SELECT * FROM orders WHERE user_id = ?', [user.id]);
}`,
      secure: `// 2 DB calls total regardless of user count
const userIds = users.map(u => u.id);
const orders = await db.query('SELECT * FROM orders WHERE user_id IN (?)', [userIds]);
const orderMap = new Map(orders.map(o => [o.userId, o]));
users.forEach(u => { u.orders = orderMap.get(u.id) ?? []; });`,
    },
    remediation: [
      { order: 1, title: 'Fetch all related data in a single batched query', description: 'WHERE id IN (ids) retrieves everything in one round-trip' },
      { order: 2, title: 'Use ORM eager loading (Prisma include, TypeORM relations)', description: 'ORMs can join automatically when told which relations to load' },
      { order: 3, title: 'Use DataLoader for GraphQL resolvers', description: 'DataLoader batches and caches per-request automatically' },
    ],
    references: [{ name: 'Prisma Query Optimization', url: 'https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance' }, { name: 'DataLoader', url: 'https://github.com/graphql/dataloader' }],
  },

  SEQUENTIAL_ASYNC: {
    what: 'Independent async operations are awaited sequentially inside a loop instead of running in parallel',
    why: 'Each await blocks until it completes — sequential operations take N × latency instead of max(latency)',
    risks: ['3 × 1-second API calls take 3 seconds instead of ~1 second', 'Throughput inversely proportional to number of items', 'Poor user experience under realistic data sizes'],
    standard: { name: 'Async Performance — Concurrency', cweName: 'Best Practice: Promise.all for independent operations', owaspUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all' },
    example: {
      vulnerable: `for (const userId of userIds) {
  await sendWelcomeEmail(userId);  // Sequential: N seconds total
}`,
      secure: `await Promise.all(userIds.map(id => sendWelcomeEmail(id)));  // ~1 second total
// For very large arrays, batch with p-limit:
import pLimit from 'p-limit';
const limit = pLimit(10);  // max 10 concurrent
await Promise.all(userIds.map(id => limit(() => sendWelcomeEmail(id))));`,
    },
    remediation: [
      { order: 1, title: 'Replace for-loop await with Promise.all()', description: 'All promises start immediately and resolve concurrently' },
      { order: 2, title: 'Use p-limit for large arrays to avoid overwhelming the target', description: 'Concurrency limit prevents thundering herd on downstream services' },
    ],
    references: [{ name: 'MDN Promise.all', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all' }, { name: 'p-limit', url: 'https://github.com/sindresorhus/p-limit' }],
  },

  NO_PAGINATION: {
    what: 'A database query returns all rows without a LIMIT clause or pagination',
    why: 'As data grows, the query loads all rows into memory — a table with 10M rows causes OOM or multi-second queries',
    risks: ['Server OOM crash when table is large', 'Multi-second response times', 'Database overloaded by full-table reads'],
    standard: { name: 'Database Performance — Pagination', cweName: 'Best Practice: Cursor-based or offset pagination', owaspUrl: 'https://use-the-index-luke.com/sql/partial-results/fetch-next-page' },
    example: {
      vulnerable: `const users = await db.query('SELECT * FROM users');`,
      secure: `const PAGE_SIZE = 50;
const users = await db.query(
  'SELECT * FROM users ORDER BY id LIMIT ? OFFSET ?',
  [PAGE_SIZE, page * PAGE_SIZE]
);`,
    },
    remediation: [
      { order: 1, title: 'Always add LIMIT to queries returning lists', description: 'Choose a sensible default (20-100) and expose page/cursor parameters' },
      { order: 2, title: 'Use cursor-based pagination for large datasets', description: 'WHERE id > :lastId LIMIT 50 is stable and performant, unlike offset' },
    ],
    references: [{ name: 'Use The Index Luke — Pagination', url: 'https://use-the-index-luke.com/sql/partial-results/fetch-next-page' }],
  },

  NESTED_LOOP: {
    what: 'Two or more nested loops over collections create O(n²) or worse complexity',
    why: 'With 1000 items, O(n²) means 1,000,000 iterations — with 10,000 items, 100 million',
    risks: ['Exponential response time growth with data volume', 'CPU saturation under realistic load', 'Timeout failures in production that never appear in tests with small data'],
    standard: { name: 'Algorithm Complexity — Time Complexity', cweName: 'Best Practice: Use hash maps for O(1) lookups', owaspUrl: 'https://en.wikipedia.org/wiki/Time_complexity' },
    example: {
      vulnerable: `users.forEach(user => {
  orders.forEach(order => {
    if (user.id === order.userId) results.push({ user, order });  // O(n²)
  });
});`,
      secure: `const userMap = new Map(users.map(u => [u.id, u]));  // O(n) build
orders.forEach(order => {
  const user = userMap.get(order.userId);          // O(1) lookup
  if (user) results.push({ user, order });
});  // Total: O(n)`,
    },
    remediation: [
      { order: 1, title: 'Build a Map or Set from one collection, then iterate the other', description: 'O(1) Map.get() replaces the inner loop entirely' },
      { order: 2, title: 'Sort + merge join for sorted datasets', description: 'O(n log n) sort once, then O(n) merge is better than O(n²) nested loop' },
    ],
    references: [{ name: 'Big O Notation', url: 'https://en.wikipedia.org/wiki/Time_complexity' }],
  },

  STRING_CONCAT_LOOP: {
    what: 'Strings are built by concatenation (+=) inside a loop',
    why: 'Each string concatenation creates a new string object — O(n²) total memory allocations for n items',
    risks: ['GC pressure from thousands of intermediate string objects', 'Quadratic memory growth', 'Slow builds of large strings (CSV, HTML, SQL)'],
    standard: { name: 'Performance — String Building', cweName: 'Best Practice: Array.join() for string accumulation', owaspUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join' },
    example: {
      vulnerable: `let csv = '';
for (const row of rows) {
  csv += row.join(',') + '\\n';  // Creates new string every iteration
}`,
      secure: `const csv = rows.map(row => row.join(',')).join('\\n');
// Or for streaming:
const lines: string[] = [];
for (const row of rows) lines.push(row.join(','));
const csv = lines.join('\\n');`,
    },
    remediation: [
      { order: 1, title: 'Accumulate parts in an array, join once at the end', description: 'parts.push(item); result = parts.join("") — O(n) total allocations' },
      { order: 2, title: 'For large output, stream to a WritableStream', description: 'Never build a 50MB string in memory — stream chunks to the client' },
    ],
    references: [{ name: 'MDN Array.join', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join' }],
  },

  UNBOUNDED_CACHE: {
    what: 'A Map, Set, or array used as a cache grows indefinitely without eviction',
    why: 'Without eviction, the cache is a memory leak — it grows until the process runs out of memory and crashes',
    risks: ['Out-of-memory crash after prolonged uptime', 'Memory growth proportional to unique inputs', 'Kubernetes pod OOMKilled restarts'],
    standard: { name: 'Performance — Cache Design', cweName: 'Best Practice: LRU Cache with size limit', owaspUrl: 'https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU' },
    example: {
      vulnerable: `const cache = new Map();  // Never cleared
function getUser(id: string) {
  if (!cache.has(id)) cache.set(id, fetchUser(id));
  return cache.get(id);
}`,
      secure: `import LRU from 'lru-cache';
const cache = new LRU<string, User>({ max: 1000, ttl: 5 * 60 * 1000 });
async function getUser(id: string) {
  return cache.get(id) ?? cache.set(id, await fetchUser(id));
}`,
    },
    remediation: [
      { order: 1, title: 'Use an LRU cache with a size cap', description: 'lru-cache npm package: { max: 1000, ttl: 300_000 }' },
      { order: 2, title: 'Add TTL (time-to-live) to prevent stale data', description: 'Entries expire automatically — no manual invalidation needed' },
    ],
    references: [{ name: 'lru-cache', url: 'https://github.com/isaacs/node-lru-cache' }, { name: 'LRU Cache Algorithm', url: 'https://en.wikipedia.org/wiki/Cache_replacement_policies#LRU' }],
  },
};

const KNOWLEDGE_BASE: Record<string, ExplanationData> = {
  ...ORIGINAL_KB,
  ...SECURITY_ADVANCED,
  ...QUALITY_KB,
  ...DEVOPS_KB,
  ...SCALABILITY_KB,
};

export class ExplanationService {
  static get(id: string): ExplanationData | undefined {
    return KNOWLEDGE_BASE[id.toUpperCase()];
  }
}
