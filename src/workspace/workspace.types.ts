export interface WorkspaceConfig {
  workspace: {
    root: string;
    allowedGlobs: string[];
    deniedGlobs?: string[];
    autoApprove: boolean;
  };
}

export interface PendingApproval {
  toolName: string;
  description: string;
  filePath?: string;
  requiresApproval: boolean;
}
