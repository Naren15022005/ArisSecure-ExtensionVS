import * as vscode from 'vscode';
import type { ExplanationData } from '../services/ExplanationService';

export type IssueDomain = 'Security' | 'Quality' | 'DevOps' | 'Scalability';

export interface IssueData {
  type: 'vulnerability' | 'secret' | 'quality' | 'devops' | 'scalability';
  domain: IssueDomain;
  title: string;
  message: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  explanation?: ExplanationData;
}

// ── Severity helpers ──────────────────────────────────────────────────────────

function severityIcon(s: IssueData['severity']): vscode.ThemeIcon {
  switch (s) {
    case 'critical': return new vscode.ThemeIcon('error');
    case 'high':     return new vscode.ThemeIcon('warning');
    case 'medium':   return new vscode.ThemeIcon('info');
    case 'low':      return new vscode.ThemeIcon('circle-outline');
  }
}

// ── Domain config ─────────────────────────────────────────────────────────────

const DOMAIN_ORDER: IssueDomain[] = ['Security', 'Quality', 'DevOps', 'Scalability'];

const DOMAIN_ICON: Record<IssueDomain, string> = {
  Security:    'shield',
  Quality:     'beaker',
  DevOps:      'server',
  Scalability: 'graph',
};

// ── Node types ────────────────────────────────────────────────────────────────

type ArisNode = DomainGroupItem | IssueItem | SectionItem | DetailItem;

export class DetailItem extends vscode.TreeItem {
  constructor(
    label: string,
    opts?: {
      description?: string;
      tooltip?: string;
      icon?: string;
      command?: vscode.Command;
    }
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    if (opts?.description) this.description = opts.description;
    if (opts?.tooltip)     this.tooltip     = opts.tooltip;
    if (opts?.icon)        this.iconPath    = new vscode.ThemeIcon(opts.icon);
    if (opts?.command)     this.command     = opts.command;
  }
}

export class SectionItem extends vscode.TreeItem {
  readonly children: DetailItem[];

  constructor(label: string, icon: string, children: DetailItem[], expanded = false) {
    super(
      label,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.iconPath = new vscode.ThemeIcon(icon);
    this.children = children;
  }
}

export class DomainGroupItem extends vscode.TreeItem {
  readonly children: IssueItem[];

  constructor(domain: IssueDomain, issues: IssueData[]) {
    super(`${domain} (${issues.length})`, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(DOMAIN_ICON[domain]);
    this.children = issues.map(i => new IssueItem(i));
  }
}

export class IssueItem extends vscode.TreeItem {
  readonly issue: IssueData;

  constructor(issue: IssueData) {
    super(
      `[L${issue.line}] ${issue.title}`,
      issue.explanation
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.issue = issue;
    this.description = issue.message.length > 60
      ? issue.message.substring(0, 60) + '…'
      : issue.message;
    this.tooltip = `${issue.domain} — ${issue.severity.toUpperCase()} — ${issue.message}`;
    this.iconPath = severityIcon(issue.severity);
    this.command = {
      title: 'Go to Issue',
      command: 'arisCode.goToIssue',
      arguments: [issue.line],
    };
  }

  getEducationItems(): ArisNode[] {
    const exp = this.issue.explanation;
    if (!exp) return [];

    const nodes: ArisNode[] = [];

    nodes.push(new DetailItem('What is it', {
      description: exp.what,
      tooltip: exp.what,
      icon: 'question',
    }));

    nodes.push(new DetailItem('Why it matters', {
      description: exp.why,
      tooltip: exp.why,
      icon: 'warning',
    }));

    nodes.push(new SectionItem(
      'Risks',
      'error',
      exp.risks.map(r => new DetailItem(r, { icon: 'circle-filled' })),
    ));

    nodes.push(new DetailItem('Standard', {
      description: exp.standard.name,
      tooltip: exp.standard.cweName,
      icon: 'book',
      command: {
        title: 'Open OWASP Reference',
        command: 'vscode.open',
        arguments: [vscode.Uri.parse(exp.standard.owaspUrl)],
      },
    }));

    const exampleItems: DetailItem[] = [
      new DetailItem('Vulnerable', {
        description: exp.example.vulnerable.split('\n').find(l => l.trim() && !l.startsWith('/')) ?? '',
        tooltip: exp.example.vulnerable,
        icon: 'error',
      }),
      new DetailItem('Secure', {
        description: exp.example.secure.split('\n').find(l => l.trim() && !l.startsWith('/')) ?? '',
        tooltip: exp.example.secure,
        icon: 'pass',
      }),
    ];
    if (exp.example.docsUrl) {
      exampleItems.push(new DetailItem('Read official docs', {
        icon: 'link-external',
        command: {
          title: 'Open Docs',
          command: 'vscode.open',
          arguments: [vscode.Uri.parse(exp.example.docsUrl)],
        },
      }));
    }
    nodes.push(new SectionItem('Example', 'code', exampleItems));

    nodes.push(new SectionItem(
      'Remediation steps',
      'checklist',
      exp.remediation.map(step => new DetailItem(
        `${step.order}. ${step.title}`,
        {
          description: step.description,
          tooltip: step.example ? `Example: ${step.example}` : step.description,
          icon: 'check',
        }
      )),
    ));

    nodes.push(new SectionItem(
      'References',
      'link-external',
      exp.references.map(ref => new DetailItem(ref.name, {
        icon: 'link-external',
        command: {
          title: 'Open Reference',
          command: 'vscode.open',
          arguments: [vscode.Uri.parse(ref.url)],
        },
      })),
    ));

    return nodes;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class IssueTreeProvider implements vscode.TreeDataProvider<ArisNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ArisNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private domainGroups: DomainGroupItem[] = [];
  private rawIssues: IssueData[] = [];

  setIssues(issues: IssueData[]): void {
    this.rawIssues = issues;

    const byDomain = new Map<IssueDomain, IssueData[]>();
    for (const d of DOMAIN_ORDER) byDomain.set(d, []);
    for (const issue of issues) byDomain.get(issue.domain)!.push(issue);

    this.domainGroups = DOMAIN_ORDER
      .filter(d => byDomain.get(d)!.length > 0)
      .map(d => new DomainGroupItem(d, byDomain.get(d)!));

    vscode.commands.executeCommand('setContext', 'arisCode:hasIssues', issues.length > 0);
    this._onDidChangeTreeData.fire(undefined);
  }

  clearIssues(): void {
    this.rawIssues = [];
    this.domainGroups = [];
    vscode.commands.executeCommand('setContext', 'arisCode:hasIssues', false);
    this._onDidChangeTreeData.fire(undefined);
  }

  getAllIssues(): IssueData[] {
    return this.rawIssues;
  }

  getTreeItem(element: ArisNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ArisNode): ArisNode[] {
    if (!element)                          return this.domainGroups;
    if (element instanceof DomainGroupItem) return element.children;
    if (element instanceof IssueItem)      return element.getEducationItems();
    if (element instanceof SectionItem)    return element.children;
    return [];
  }
}
