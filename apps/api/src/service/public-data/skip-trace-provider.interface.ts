export interface OwnerPhone {
  number: string;
  type: string;
  rank: number;
}

export interface SkipTraceInput {
  bbl: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface SkipTraceResult {
  bbl: string;
  phones: OwnerPhone[];
  emails: string[];
  found: boolean;
}

export interface SkipTraceProvider {
  readonly name: string;
  trace(inputs: SkipTraceInput[]): Promise<SkipTraceResult[]>;
  checkBalance?(): Promise<number | null>;
}

export const SKIP_TRACE_PROVIDER = Symbol('SKIP_TRACE_PROVIDER');
