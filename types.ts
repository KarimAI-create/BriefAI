
export enum View {
  HOME = 'HOME',
  UPLOAD_BRIEF = 'UPLOAD_BRIEF',
  CONTENT_IDEAS = 'CONTENT_IDEAS',
  COMPLIANCE_CHECKER = 'COMPLIANCE_CHECKER',
  LANDING_PAGE_GENERATOR = 'LANDING_PAGE_GENERATOR',
  PERFORMANCE_TRACKER = 'PERFORMANCE_TRACKER',
  DASHBOARD = 'DASHBOARD',
}

export interface BriefRequirements {
  campaignName?: string;
  brandTags?: string[];
  platformRules?: string[];
  regionTargeting?: string[];
  minVideoLengthSeconds?: number;
  viewThreshold?: number;
  assetLinks?: string[];
  otherInstructions?: string[];
}

export interface ContentIdea {
  title: string;
  hook: string;
  caption: string;
  tone: string;
}

export interface ComplianceItem {
  id: string;
  text: string;
  isMet: boolean | null; // null for pending, true for met, false for not met
  details?: string;
}

export interface Campaign {
  id: string;
  name: string;
  briefText: string;
  requirements?: BriefRequirements;
  ideas?: ContentIdea[];
  complianceChecklist?: ComplianceItem[];
  videoFile?: File;
  videoUrl?: string; // For performance tracking
  status: 'New' | 'Brief Processed' | 'Ideas Generated' | 'Compliance Checked' | 'Submitted';
  createdAt: string;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  retrievedContext?: {
    uri?: string;
    title?: string;
  };
}
