export type CalculatorAngleMode = "deg" | "rad";

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "^" | "%" }
  | { type: "paren"; value: "(" | ")" };

type OperatorValue = Extract<Token, { type: "operator" }>["value"];

type EvaluateOptions = {
  angleMode: CalculatorAngleMode;
  ans?: number;
};

const normaliseExpression = (expression: string) =>
  expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt");

const tokenize = (expression: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = normaliseExpression(expression);

  while (remaining.length) {
    const whitespace = remaining.match(/^\s+/);
    if (whitespace) {
      remaining = remaining.slice(whitespace[0].length);
      continue;
    }

    const number = remaining.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      remaining = remaining.slice(number[0].length);
      continue;
    }

    const identifier = remaining.match(/^[a-zA-Z]+/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0].toLowerCase() });
      remaining = remaining.slice(identifier[0].length);
      continue;
    }

    const char = remaining[0];
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      remaining = remaining.slice(1);
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/" || char === "^" || char === "%") {
      tokens.push({ type: "operator", value: char });
      remaining = remaining.slice(1);
      continue;
    }

    throw new Error(`Unexpected token "${char}"`);
  }

  return tokens;
};

class CalculatorParser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly options: EvaluateOptions
  ) {}

  parse() {
    const value = this.parseAddSub();
    if (this.peek()) throw new Error("Unexpected input after expression");
    if (!Number.isFinite(value)) throw new Error("Result is not a real finite number");
    return value;
  }

  private parseAddSub(): number {
    let value = this.parseMulDiv();
    while (this.matchOperator("+") || this.matchOperator("-")) {
      const operator = this.previous().value;
      const next = this.parseMulDiv();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  private parseMulDiv(): number {
    let value = this.parsePower();
    while (this.matchOperator("*") || this.matchOperator("/")) {
      const operator = this.previous().value;
      const next = this.parsePower();
      if (operator === "/" && next === 0) throw new Error("Cannot divide by zero");
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  }

  private parsePower(): number {
    const value = this.parseUnary();
    if (this.matchOperator("^")) {
      return Math.pow(value, this.parsePower());
    }
    return value;
  }

  private parseUnary(): number {
    if (this.matchOperator("+")) return this.parseUnary();
    if (this.matchOperator("-")) return -this.parseUnary();
    return this.parsePostfix();
  }

  private parsePostfix(): number {
    let value = this.parsePrimary();
    while (this.matchOperator("%")) {
      value /= 100;
    }
    return value;
  }

  private parsePrimary(): number {
    const token = this.advance();
    if (!token) throw new Error("Expression is incomplete");

    if (token.type === "number") return token.value;

    if (token.type === "identifier") {
      if (token.value === "pi") return Math.PI;
      if (token.value === "e") return Math.E;
      if (token.value === "ans") return this.options.ans ?? 0;
      return this.parseFunction(token.value);
    }

    if (token.type === "paren" && token.value === "(") {
      const value = this.parseAddSub();
      if (!this.matchParen(")")) throw new Error("Missing closing bracket");
      return value;
    }

    throw new Error("Expected a number, function or bracket");
  }

  private parseFunction(name: string) {
    if (!this.matchParen("(")) throw new Error(`${name} needs brackets`);
    const value = this.parseAddSub();
    if (!this.matchParen(")")) throw new Error(`Missing closing bracket for ${name}`);

    const toRadians = (angle: number) => (this.options.angleMode === "deg" ? (angle * Math.PI) / 180 : angle);
    const fromRadians = (angle: number) => (this.options.angleMode === "deg" ? (angle * 180) / Math.PI : angle);

    switch (name) {
      case "sin":
        return Math.sin(toRadians(value));
      case "cos":
        return Math.cos(toRadians(value));
      case "tan":
        return Math.tan(toRadians(value));
      case "asin":
        return fromRadians(Math.asin(value));
      case "acos":
        return fromRadians(Math.acos(value));
      case "atan":
        return fromRadians(Math.atan(value));
      case "log":
        if (value <= 0) throw new Error("log needs a positive value");
        return Math.log10(value);
      case "ln":
        if (value <= 0) throw new Error("ln needs a positive value");
        return Math.log(value);
      case "sqrt":
        if (value < 0) throw new Error("sqrt needs a non-negative value");
        return Math.sqrt(value);
      case "abs":
        return Math.abs(value);
      case "exp":
        return Math.exp(value);
      default:
        throw new Error(`Unknown function "${name}"`);
    }
  }

  private peek() {
    return this.tokens[this.index];
  }

  private previous() {
    return this.tokens[this.index - 1] as Token;
  }

  private advance() {
    return this.tokens[this.index++];
  }

  private matchOperator(value: OperatorValue) {
    const token = this.peek();
    if (token?.type !== "operator" || token.value !== value) return false;
    this.index += 1;
    return true;
  }

  private matchParen(value: "(" | ")") {
    const token = this.peek();
    if (token?.type !== "paren" || token.value !== value) return false;
    this.index += 1;
    return true;
  }
}

export const formatCalculatorResult = (value: number) => {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Math.abs(value) < 1e-10 ? 0 : value;
  if (Number.isInteger(rounded)) return String(rounded);
  if (Math.abs(rounded) >= 1e10 || Math.abs(rounded) < 1e-6) return rounded.toExponential(8);
  return Number(rounded.toPrecision(12)).toString();
};

export const evaluateScientificExpression = (expression: string, options: EvaluateOptions) => {
  const tokens = tokenize(expression);
  if (!tokens.length) throw new Error("Enter a calculation first");
  return new CalculatorParser(tokens, options).parse();
};
