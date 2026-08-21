export const DEPARTMENT_CODES = ['01', '02', '03'] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

export const DEPARTMENT_LABELS: Record<DepartmentCode, string> = {
  '01': '高中部',
  '02': '初中部',
  '03': '小学部',
};

export const ROLES = ['ADMIN', 'TEACHER', 'REPRESENTATIVE'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: '管理员',
  TEACHER: '教师',
  REPRESENTATIVE: '课代表',
};

export const ASSIGNMENT_STATUSES = ['DRAFT', 'COLLECTING', 'FINISHED'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export interface UserDto {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface ClassDto {
  id: string;
  entryYear: number;
  department: DepartmentCode;
  classNumber: number;
  studentCount: number;
}

export interface JoinableClassDto extends ClassDto {
  joined: boolean;
}

export interface ClassBatchResult {
  created: { entryYear: number; department: DepartmentCode; classNumber: number }[];
  skipped: { entryYear: number; department: DepartmentCode; classNumber: number }[];
}

export interface StudentDto {
  id: string;
  name: string;
  studentNumber: string;
  entryYear: number;
  department: DepartmentCode;
  classNumber: number;
  numberInClass: number;
  qrToken: string;
  classId: string;
  createdAt: string;
}

export interface AssignmentDto {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  createdById: string;
  status: AssignmentStatus;
  createdAt: string;
  totalCount?: number;
  submittedCount?: number;
}

export interface SubmissionDto {
  id: string;
  assignmentId: string;
  studentId: string;
  operatorId: string;
  submittedAt: string;
  studentName?: string;
  studentNumber?: string;
  numberInClass?: number;
  operatorName?: string;
}

export interface AssignmentStats {
  assignmentId: string;
  total: number;
  submitted: number;
  unsubmitted: number;
}

export interface ParsedStudentNumber {
  entryYear: number;
  department: DepartmentCode;
  classNumber: number;
  numberInClass: number;
}

export interface ImportRow {
  studentNumber: string;
  name: string;
}

export type ImportIssueReason =
  | 'invalid_number'
  | 'missing_name'
  | 'duplicate_in_file'
  | 'duplicate_in_db'
  | 'not_joined_class';

export interface ImportValidationIssue {
  row: number;
  studentNumber: string;
  name: string;
  reason: ImportIssueReason;
}

export interface ImportPreview {
  total: number;
  validCount: number;
  issueCount: number;
  valid: ImportRow[];
  issues: ImportValidationIssue[];
}

export interface ImportResult {
  created: number;
  skipped: ImportValidationIssue[];
}

export interface ApiError {
  error: string;
  message: string;
}
