import {
  IssueTreeProvider,
  IssueData,
  SeverityGroupItem,
  IssueItem,
  SectionItem,
  DetailItem,
} from '../../src/views/IssueTreeProvider';
import type { ExplanationData } from '../../src/services/ExplanationService';

jest.mock('vscode', () => {
  const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };

  class EventEmitter {
    event = jest.fn();
    fire = jest.fn();
  }

  class TreeItem {
    label: string;
    collapsibleState: number;
    description?: string;
    tooltip?: string;
    iconPath?: unknown;
    command?: unknown;
    constructor(label: string, state = TreeItemCollapsibleState.None) {
      this.label = label;
      this.collapsibleState = state;
    }
  }

  class ThemeIcon {
    constructor(public id: string) {}
  }

  class ThemeColor {
    constructor(public id: string) {}
  }

  class MarkdownString {
    value: string;
    constructor(v: string) { this.value = v; }
  }

  const Uri = {
    parse: jest.fn((url: string) => ({ toString: () => url })),
    file: jest.fn(),
  };

  return {
    TreeItemCollapsibleState,
    EventEmitter,
    TreeItem,
    ThemeIcon,
    ThemeColor,
    MarkdownString,
    Uri,
    commands: { executeCommand: jest.fn(), registerCommand: jest.fn() },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vscode = require('vscode') as typeof import('vscode');

// ── Test fixtures ─────────────────────────────────────────────────────────────

const MOCK_EXPLANATION: ExplanationData = {
  what: 'User input concatenated into SQL query',
  why: 'Attacker can inject arbitrary SQL commands',
  risks: ['Data theft', 'Authentication bypass'],
  standard: {
    name: 'OWASP A03:2021',
    cweName: 'CWE-89',
    owaspUrl: 'https://owasp.org/example',
  },
  example: {
    vulnerable: 'const q = "SELECT * FROM t WHERE id = " + id;',
    secure: 'const q = "SELECT * FROM t WHERE id = ?"; db.run(q, [id]);',
    docsUrl: 'https://example.com/docs',
  },
  remediation: [
    { order: 1, title: 'Use parameterized queries', description: 'Replace concatenation with placeholders' },
  ],
  references: [
    { name: 'OWASP SQL Injection', url: 'https://owasp.org/example' },
  ],
};

function makeVuln(severity: IssueData['severity'], line: number, withExplanation = false): IssueData {
  return {
    type: 'vulnerability',
    domain: 'Security',
    title: 'SQL_INJECTION',
    message: 'SQL injection risk',
    line,
    severity,
    explanation: withExplanation ? MOCK_EXPLANATION : undefined,
  };
}

function makeSecret(line: number): IssueData {
  return {
    type: 'secret',
    domain: 'Security',
    title: 'AWS_ACCESS_KEY',
    message: 'Hardcoded secret',
    line,
    severity: 'critical',
  };
}

function makeQuality(line: number): IssueData {
  return {
    type: 'quality',
    domain: 'Quality',
    title: 'CONSOLE_LOG',
    message: 'console.log in production',
    line,
    severity: 'low',
  };
}

function makeDevOps(line: number): IssueData {
  return {
    type: 'devops',
    domain: 'DevOps',
    title: 'HARDCODED_IP',
    message: 'Hardcoded IP address',
    line,
    severity: 'medium',
  };
}

function makeScalability(line: number): IssueData {
  return {
    type: 'scalability',
    domain: 'Scalability',
    title: 'N_PLUS_ONE',
    message: 'Query inside loop',
    line,
    severity: 'high',
  };
}

// ── IssueTreeProvider suite ───────────────────────────────────────────────────

describe('IssueTreeProvider', () => {
  let provider: IssueTreeProvider;

  beforeEach(() => {
    (vscode.commands.executeCommand as jest.Mock).mockClear();
    provider = new IssueTreeProvider();
  });

  it('returns empty root when no issues set', () => {
    expect(provider.getChildren()).toHaveLength(0);
  });

  it('setIssues groups by severity', () => {
    // high + medium + low = 3 distinct severity groups
    provider.setIssues([makeVuln('high', 1), makeDevOps(10), makeQuality(5)]);
    const groups = provider.getChildren() as SeverityGroupItem[];
    expect(groups).toHaveLength(3);
    const labels = groups.map(g => String(g.label));
    expect(labels.some(l => l.includes('High'))).toBe(true);
    expect(labels.some(l => l.includes('Medium'))).toBe(true);
    expect(labels.some(l => l.includes('Low'))).toBe(true);
  });

  it('severity groups are in order: Critical, High, Medium, Low', () => {
    provider.setIssues([
      makeScalability(1),  // high
      makeQuality(2),       // low
      makeVuln('critical', 3),
      makeDevOps(4),        // medium
    ]);
    const groups = provider.getChildren() as SeverityGroupItem[];
    const labels = groups.map(g => String(g.label));
    expect(labels[0]).toMatch(/Critical/);
    expect(labels[1]).toMatch(/High/);
    expect(labels[2]).toMatch(/Medium/);
    expect(labels[3]).toMatch(/Low/);
  });

  it('omits severity levels with no issues', () => {
    provider.setIssues([makeVuln('high', 1)]);
    const groups = provider.getChildren() as SeverityGroupItem[];
    expect(groups).toHaveLength(1);
    expect(String(groups[0].label)).toMatch(/High/);
  });

  it('severity group label shows issue count', () => {
    provider.setIssues([makeVuln('high', 1), makeVuln('high', 2)]);
    const [group] = provider.getChildren() as SeverityGroupItem[];
    expect(String(group.label)).toContain('2');
  });

  it('group children are IssueItems', () => {
    provider.setIssues([makeVuln('high', 3), makeVuln('high', 7)]);
    const [group] = provider.getChildren() as SeverityGroupItem[];
    const children = provider.getChildren(group) as IssueItem[];
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(IssueItem);
    expect(children[0].issue.line).toBe(3);
  });

  it('IssueItem label includes line number and title', () => {
    const item = new IssueItem(makeVuln('medium', 42));
    expect(String(item.label)).toContain('L42');
    expect(String(item.label)).toContain('SQL_INJECTION');
  });

  it('IssueItem command points to showIssueDetail with correct issue', () => {
    const issue = makeVuln('low', 10);
    const item = new IssueItem(issue);
    const cmd = item.command as { command: string; arguments: IssueData[] };
    expect(cmd.command).toBe('arisCode.showIssueDetail');
    expect(cmd.arguments[0].line).toBe(10);
    expect(cmd.arguments[0].title).toBe('SQL_INJECTION');
  });

  it('setIssues calls setContext with true when issues exist', () => {
    provider.setIssues([makeVuln('high', 1)]);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'arisCode:hasIssues', true);
  });

  it('clearIssues empties the list and calls setContext false', () => {
    provider.setIssues([makeVuln('high', 1)]);
    provider.clearIssues();
    expect(provider.getChildren()).toHaveLength(0);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'arisCode:hasIssues', false);
  });

  it('getTreeItem returns the element itself', () => {
    const item = new IssueItem(makeSecret(5));
    expect(provider.getTreeItem(item)).toBe(item);
  });

  it('getAllIssues returns all stored issues', () => {
    const issues = [makeVuln('high', 1), makeQuality(5), makeSecret(10)];
    provider.setIssues(issues);
    expect(provider.getAllIssues()).toHaveLength(3);
  });

  it('getAllIssues returns empty array before first setIssues', () => {
    expect(provider.getAllIssues()).toHaveLength(0);
  });

  it('does not throw on empty issue array', () => {
    expect(() => provider.setIssues([])).not.toThrow();
    expect(provider.getChildren()).toHaveLength(0);
  });

  it('all four severity levels render when all present', () => {
    provider.setIssues([
      makeVuln('critical', 1),
      makeVuln('high', 2),
      makeDevOps(3),    // medium
      makeQuality(4),   // low
    ]);
    const groups = provider.getChildren() as SeverityGroupItem[];
    expect(groups).toHaveLength(4);
  });

  it('IssueItem has contextValue "issue" for context menus', () => {
    const item = new IssueItem(makeVuln('high', 1));
    expect(item.contextValue).toBe('issue');
  });

  it('IssueItem description includes domain badge', () => {
    const item = new IssueItem(makeVuln('high', 1));
    expect(String(item.description)).toContain('[SEC]');
  });
});

// ── IssueItem collapsible state ───────────────────────────────────────────────

describe('IssueItem collapsible state', () => {
  it('is None when no explanation is provided', () => {
    const item = new IssueItem(makeVuln('medium', 1));
    expect(item.collapsibleState).toBe(0); // None
  });

  it('is Collapsed when an explanation is provided', () => {
    const item = new IssueItem(makeVuln('critical', 1, true));
    expect(item.collapsibleState).toBe(1); // Collapsed
  });
});

// ── Educational tree content ──────────────────────────────────────────────────

describe('IssueItem education items', () => {
  it('returns empty array when no explanation', () => {
    const item = new IssueItem(makeVuln('low', 1));
    expect(item.getEducationItems()).toHaveLength(0);
  });

  it('returns education nodes when explanation is set', () => {
    const item = new IssueItem(makeVuln('critical', 5, true));
    expect(item.getEducationItems().length).toBeGreaterThan(0);
  });

  it('includes What, Why, Risks, Standard, Example, Remediation, References nodes', () => {
    const item = new IssueItem(makeVuln('critical', 5, true));
    const labels = item.getEducationItems().map(n => String(n.label));

    expect(labels.some(l => l.includes('What'))).toBe(true);
    expect(labels.some(l => l.includes('Why'))).toBe(true);
    expect(labels.some(l => l.includes('Risks'))).toBe(true);
    expect(labels.some(l => l.includes('Standard'))).toBe(true);
    expect(labels.some(l => l.includes('Example'))).toBe(true);
    expect(labels.some(l => l.includes('Remediation'))).toBe(true);
    expect(labels.some(l => l.includes('References'))).toBe(true);
  });

  it('Risks is a SectionItem containing a DetailItem per risk entry', () => {
    const item = new IssueItem(makeVuln('critical', 5, true));
    const nodes = item.getEducationItems();
    const risksSection = nodes.find(n => String(n.label) === 'Risks') as SectionItem;

    expect(risksSection).toBeInstanceOf(SectionItem);
    expect(risksSection.children).toHaveLength(MOCK_EXPLANATION.risks.length);
    expect(risksSection.children[0]).toBeInstanceOf(DetailItem);
    expect(String(risksSection.children[0].label)).toContain(MOCK_EXPLANATION.risks[0]);
  });

  it('Remediation section lists steps in order', () => {
    const item = new IssueItem(makeVuln('critical', 5, true));
    const nodes = item.getEducationItems();
    const remSection = nodes.find(n => String(n.label).startsWith('Remediation')) as SectionItem;

    expect(remSection).toBeInstanceOf(SectionItem);
    expect(remSection.children).toHaveLength(MOCK_EXPLANATION.remediation.length);
    expect(String(remSection.children[0].label)).toContain('1.');
  });

  it('Example section contains Vulnerable and Secure children', () => {
    const item = new IssueItem(makeVuln('critical', 5, true));
    const nodes = item.getEducationItems();
    const exampleSection = nodes.find(n => String(n.label) === 'Example') as SectionItem;

    expect(exampleSection).toBeInstanceOf(SectionItem);
    const childLabels = exampleSection.children.map(c => String(c.label));
    expect(childLabels.some(l => l.includes('Vulnerable'))).toBe(true);
    expect(childLabels.some(l => l.includes('Secure'))).toBe(true);
  });

  it('Example section includes docs link when docsUrl is set', () => {
    const item = new IssueItem(makeVuln('critical', 5, true));
    const nodes = item.getEducationItems();
    const exampleSection = nodes.find(n => String(n.label) === 'Example') as SectionItem;

    expect(exampleSection.children.some(c => String(c.label).includes('docs'))).toBe(true);
  });

  it('provider getChildren dispatches to IssueItem.getEducationItems', () => {
    const provider = new IssueTreeProvider();
    provider.setIssues([makeVuln('critical', 7, true)]);
    const [group] = provider.getChildren() as SeverityGroupItem[];
    const [issueItem] = provider.getChildren(group) as IssueItem[];
    const educationNodes = provider.getChildren(issueItem);

    expect(educationNodes.length).toBeGreaterThan(0);
  });

  it('provider getChildren dispatches to SectionItem.children', () => {
    const provider = new IssueTreeProvider();
    provider.setIssues([makeVuln('critical', 7, true)]);
    const [group] = provider.getChildren() as SeverityGroupItem[];
    const [issueItem] = provider.getChildren(group) as IssueItem[];
    const educationNodes = provider.getChildren(issueItem);
    const risksSection = educationNodes.find(n => String(n.label) === 'Risks') as SectionItem;
    const riskChildren = provider.getChildren(risksSection);

    expect(riskChildren.length).toBe(MOCK_EXPLANATION.risks.length);
    expect(riskChildren[0]).toBeInstanceOf(DetailItem);
  });
});

// ── ExplanationService integration ───────────────────────────────────────────

describe('ExplanationService integration', () => {
  it('SQL_INJECTION explanation is found by key', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    const exp = ExplanationService.get('SQL_INJECTION');
    expect(exp).toBeDefined();
    expect(exp.risks.length).toBeGreaterThan(0);
    expect(exp.remediation.length).toBeGreaterThan(0);
    expect(exp.references.length).toBeGreaterThan(0);
  });

  it('key lookup is case-insensitive', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    expect(ExplanationService.get('sql_injection')).toBeDefined();
    expect(ExplanationService.get('Sql_Injection')).toBeDefined();
  });

  it('returns undefined for unknown keys', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    expect(ExplanationService.get('NONEXISTENT_RULE')).toBeUndefined();
  });

  it('PASSWORD explanation exists for secrets', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    expect(ExplanationService.get('PASSWORD')).toBeDefined();
  });

  it('new domain entries are accessible — NOSQL_INJECTION', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    expect(ExplanationService.get('NOSQL_INJECTION')).toBeDefined();
  });

  it('new domain entries are accessible — LONG_FUNCTION', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    expect(ExplanationService.get('LONG_FUNCTION')).toBeDefined();
  });

  it('new domain entries are accessible — HARDCODED_IP', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    expect(ExplanationService.get('HARDCODED_IP')).toBeDefined();
  });

  it('new domain entries are accessible — N_PLUS_ONE', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExplanationService } = require('../../src/services/ExplanationService');
    expect(ExplanationService.get('N_PLUS_ONE')).toBeDefined();
  });
});
