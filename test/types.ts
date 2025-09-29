export interface Scenario {
  name: string;
  run: () => Promise<void>;
}
