/**
 * ==============================================================================
 * G-Merge / Gammadyne Mailer Compatible Scripting & Template Engine
 * ==============================================================================
 * Evaluates double-bracket statements [[ ... ]] with support for:
 * - Literals (Number, String with "" escapes, Boolean TRUE/FALSE, Date #...#, NULL)
 * - Predefined variables (-FirstName-, -LastName-, -FullName-, -Company-, -Domain-,
 *   -Email-, -Index-, -MessageID-, -Now-, -OperationType-, -Recipient-, -TID-, -User-, CR)
 * - Variable declarations ([[var foo = 5, bar = "abc"]])
 * - Assignments ([[let foo = 10]], [[let n += 1]], [[let name += ", Jr."]])
 * - Variable defaults ([[-FirstName-:Customer]], [[City:Metropolis]])
 * - Advanced Date formatting (y, yy, Y, YY, m, mm, M, MM, d, dd, D, DD, w, W, WW, h, hh, H, HH, i, ii, s, ss, ap, AP, b, ~, @, ~@)
 * - Data switching ([[Color|1|red|2|blue|3|green|black]])
 * - Math, arithmetic & relational operators with strict precedence
 * - Date arithmetic ([[-Now- + 7]], [[-Now- - order_date]])
 * - Compound statements ([[12; 34]])
 * - Comments (//, /* ... *\/, rem, [[if FALSE]]...[[endif]])
 * - Conditionals ([[if ...]] ... [[elseif ...]] ... [[else]] ... [[endif]])
 * - Built-in functions & User-Defined Functions ([[function ... endfunction]])
 * - [[raw ...]] directives and braced column identifiers [[{purchase date}]]
 * - Escaping: [[[ escapes to [[
 * ==============================================================================
 */

export interface GMergeContext {
  recipient?: {
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    domain?: string;
    compoundRecipient?: string;
    index?: number;
    tid?: string | number;
    [key: string]: any;
  };
  variables?: Record<string, any>;
  customColumns?: Record<string, any>;
  messageId?: string;
  operationType?: number;
  now?: Date;
  userFunctions?: Record<string, { params: string[]; body: string }>;
}

export interface GMergeEvaluationResult {
  output: string;
  variables: Record<string, any>;
  errors: string[];
  executionTimeMs: number;
}

// Helper: Ordinal numbers (1st, 2nd, 3rd, 4th, 5th...)
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Helper: Ordinal text words (first, second, third...)
const ORDINAL_WORDS: Record<number, string> = {
  1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
  6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
  11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth',
  16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth',
  21: 'twenty-first', 22: 'twenty-second', 23: 'twenty-third', 24: 'twenty-fourth', 25: 'twenty-fifth',
  26: 'twenty-sixth', 27: 'twenty-seventh', 28: 'twenty-eighth', 29: 'twenty-ninth', 30: 'thirtieth', 31: 'thirty-first'
};

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format a Date object according to G-Merge formatting rules
 */
export function formatGMergeDate(date: Date, formatPattern: string): string {
  if (isNaN(date.getTime())) return '';
  if (!formatPattern || formatPattern.trim() === '') {
    // Default G-Merge format: m/d/yy h:ii:ss ap
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)} ${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}${date.getHours() >= 12 ? 'p' : 'a'}`;
  }

  // Regional format specifiers
  if (formatPattern === '~') {
    return date.toLocaleDateString();
  }
  if (formatPattern === '@') {
    return date.toLocaleTimeString();
  }
  if (formatPattern === '~@') {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }

  let result = '';
  let i = 0;
  while (i < formatPattern.length) {
    const ch = formatPattern[i];
    const next2 = formatPattern.slice(i, i + 2);

    if (next2 === 'YY') {
      result += String(date.getFullYear());
      i += 2;
    } else if (next2 === 'yy') {
      result += String(date.getFullYear()).slice(-2);
      i += 2;
    } else if (ch === 'Y') {
      result += String(date.getFullYear());
      i++;
    } else if (ch === 'y') {
      result += String(date.getFullYear()).slice(-2);
      i++;
    } else if (next2 === 'MM') {
      result += MONTH_NAMES_FULL[date.getMonth()];
      i += 2;
    } else if (next2 === 'mm') {
      result += String(date.getMonth() + 1).padStart(2, '0');
      i += 2;
    } else if (ch === 'M') {
      result += MONTH_NAMES_SHORT[date.getMonth()];
      i++;
    } else if (ch === 'm') {
      result += String(date.getMonth() + 1);
      i++;
    } else if (next2 === 'DD') {
      result += ORDINAL_WORDS[date.getDate()] || getOrdinalSuffix(date.getDate());
      i += 2;
    } else if (next2 === 'dd') {
      result += String(date.getDate()).padStart(2, '0');
      i += 2;
    } else if (ch === 'D') {
      result += getOrdinalSuffix(date.getDate());
      i++;
    } else if (ch === 'd') {
      result += String(date.getDate());
      i++;
    } else if (formatPattern.slice(i, i + 2) === 'WW') {
      result += DAY_NAMES_FULL[date.getDay()];
      i += 2;
    } else if (ch === 'W') {
      result += DAY_NAMES_SHORT[date.getDay()];
      i++;
    } else if (ch === 'w') {
      result += String(date.getDay());
      i++;
    } else if (next2 === 'HH') {
      result += String(date.getHours()).padStart(2, '0');
      i += 2;
    } else if (ch === 'H') {
      result += String(date.getHours());
      i++;
    } else if (next2 === 'hh') {
      const h12 = date.getHours() % 12 || 12;
      result += String(h12).padStart(2, '0');
      i += 2;
    } else if (ch === 'h') {
      result += String(date.getHours() % 12 || 12);
      i++;
    } else if (next2 === 'ii') {
      result += String(date.getMinutes()).padStart(2, '0');
      i += 2;
    } else if (ch === 'i') {
      result += String(date.getMinutes());
      i++;
    } else if (next2 === 'ss') {
      result += String(date.getSeconds()).padStart(2, '0');
      i += 2;
    } else if (ch === 's') {
      result += String(date.getSeconds());
      i++;
    } else if (next2 === 'AP') {
      result += date.getHours() >= 12 ? 'PM' : 'AM';
      i += 2;
    } else if (next2 === 'ap') {
      result += date.getHours() >= 12 ? 'pm' : 'am';
      i += 2;
    } else if (ch === 'b') {
      const offset = -date.getTimezoneOffset();
      const sign = offset >= 0 ? '+' : '-';
      const absOffset = Math.abs(offset);
      const hours = Math.floor(absOffset / 60);
      const mins = absOffset % 60;
      result += `${sign}${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
      i++;
    } else {
      result += ch;
      i++;
    }
  }

  return result;
}

/**
 * Built-in G-Merge standard functions
 */
export const GMERGE_BUILTIN_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  convert_lower_case: (val: any) => String(val ?? '').toLowerCase(),
  convert_upper_case: (val: any) => String(val ?? '').toUpperCase(),
  extract_first_name: (fullName: any) => {
    const s = String(fullName ?? '').trim();
    if (!s) return '';
    return s.split(/\s+/)[0] || '';
  },
  extract_last_name: (fullName: any) => {
    const s = String(fullName ?? '').trim();
    if (!s) return '';
    const parts = s.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  },
  date_format: (dateVal: any, pattern: string) => {
    let d: Date;
    if (dateVal instanceof Date) d = dateVal;
    else if (typeof dateVal === 'number') d = new Date(dateVal);
    else d = new Date(String(dateVal));
    return formatGMergeDate(d, pattern);
  },
  field_exists: (fieldVal: any) => fieldVal !== undefined && fieldVal !== null && fieldVal !== '',
  length: (val: any) => String(val ?? '').length,
  trim: (val: any) => String(val ?? '').trim(),
  round: (val: any, decimals = 0) => {
    const num = Number(val) || 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },
  abs: (val: any) => Math.abs(Number(val) || 0),
  min: (...args: any[]) => Math.min(...args.map(a => Number(a) || 0)),
  max: (...args: any[]) => Math.max(...args.map(a => Number(a) || 0)),
  if_empty: (val: any, fallback: any) => {
    if (val === undefined || val === null || val === '') return fallback;
    return val;
  },
  replace: (target: any, search: any, replacement: any) => {
    return String(target ?? '').split(String(search ?? '')).join(String(replacement ?? ''));
  },
  contains: (target: any, search: any) => {
    return String(target ?? '').toLowerCase().includes(String(search ?? '').toLowerCase());
  },
  unicode_to_utf8: (val: any) => String(val ?? ''),
  log: (...args: any[]) => {
    console.log('[G-Merge log]:', ...args);
    return '';
  }
};

/**
 * Parses and evaluates an expression inside a G-Merge statement
 */
class ExpressionEvaluator {
  private variables: Record<string, any>;
  private context: GMergeContext;
  private userFunctions: Record<string, { params: string[]; body: string }>;

  constructor(context: GMergeContext, variables: Record<string, any>) {
    this.context = context;
    this.variables = variables;
    this.userFunctions = context.userFunctions || {};
  }

  public getVariables() {
    return this.variables;
  }

  /**
   * Main entry for single statement evaluation
   */
  public evaluateStatement(stmt: string): any {
    let s = stmt.trim();
    if (!s) return '';

    // Check for comment
    if (s.startsWith('//') || s.toLowerCase().startsWith('rem ')) {
      return '';
    }

    // Strip multiline comment /* ... */
    s = s.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!s) return '';

    // Check for [[raw ...]] directive
    if (s.toLowerCase().startsWith('raw ')) {
      return this.evaluateExpression(s.slice(4).trim());
    }

    // Check for user function declaration: function name(param1, param2) return expr; endfunction
    const funcMatch = s.match(/^function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*([\s\S]*?)\s*endfunction$/i);
    if (funcMatch) {
      const funcName = funcMatch[1].toLowerCase();
      const params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      let body = funcMatch[3].trim();
      if (body.toLowerCase().startsWith('return ')) {
        body = body.slice(7).trim();
      }
      if (body.endsWith(';')) body = body.slice(0, -1).trim();
      this.userFunctions[funcName] = { params, body };
      return '';
    }

    // Variable declaration: var foo = 5, bar = "abc"
    if (s.toLowerCase().startsWith('var ')) {
      const decls = s.slice(4).trim();
      this.handleVariableDeclarations(decls);
      return '';
    }

    // Assignment: let foo = 10, let num += 1, let name += ", Jr."
    if (s.toLowerCase().startsWith('let ')) {
      const assign = s.slice(4).trim();
      this.handleAssignment(assign);
      return '';
    }

    // Data switching: [[Color|1|red|2|blue|3|green|black]]
    if (s.includes('|') && !s.includes('||')) {
      const parts = s.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        const testVal = this.evaluateExpression(parts[0]);
        for (let i = 1; i < parts.length - 1; i += 2) {
          const matchVal = this.evaluateExpression(parts[i]);
          if (String(testVal).toLowerCase() === String(matchVal).toLowerCase()) {
            return this.evaluateExpression(parts[i + 1]);
          }
        }
        // Fallback default if odd number of parameters
        if (parts.length % 2 === 0) {
          return this.evaluateExpression(parts[parts.length - 1]);
        }
        return '';
      }
    }

    // Variable default: [[-FirstName-:Customer]] or [[City:Metropolis]] or date format [[-Now-:MM D, yy]]
    const colonIdx = this.findUnquotedChar(s, ':');
    if (colonIdx > 0 && !s.startsWith('#')) {
      const leftPart = s.slice(0, colonIdx).trim();
      const rightPart = s.slice(colonIdx + 1).trim();

      const leftVal = this.evaluateExpression(leftPart);

      // Check if left value is a Date -> apply date formatting
      if (leftVal instanceof Date || (typeof leftVal === 'string' && leftVal.startsWith('#') && leftVal.endsWith('#'))) {
        const d = leftVal instanceof Date ? leftVal : this.parseDateLiteral(leftVal);
        return formatGMergeDate(d, rightPart);
      }

      // Check if left is empty/undefined -> substitute fallback
      if (leftVal === undefined || leftVal === null || leftVal === '') {
        return this.evaluateExpression(rightPart);
      }
      return leftVal;
    }

    // Evaluate standard expression (Math, Functions, Columns, Predefined vars)
    return this.evaluateExpression(s);
  }

  private handleVariableDeclarations(declStr: string) {
    const parts = this.splitByComma(declStr);
    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) {
        const varName = part.slice(0, eqIdx).trim();
        const expr = part.slice(eqIdx + 1).trim();
        this.variables[varName] = this.evaluateExpression(expr);
      }
    }
  }

  private handleAssignment(assignStr: string) {
    // Check for += or -= or =
    let op = '=';
    let splitIdx = assignStr.indexOf('+=');
    if (splitIdx > 0) {
      op = '+=';
    } else {
      splitIdx = assignStr.indexOf('-=');
      if (splitIdx > 0) {
        op = '-=';
      } else {
        splitIdx = assignStr.indexOf('=');
      }
    }

    if (splitIdx <= 0) return;
    const varName = assignStr.slice(0, splitIdx).trim();
    const rightExpr = assignStr.slice(splitIdx + (op.length)).trim();
    const rightVal = this.evaluateExpression(rightExpr);

    const currentVal = this.lookupVariable(varName);

    if (op === '+=') {
      if (typeof currentVal === 'number' && typeof rightVal === 'number') {
        this.variables[varName] = currentVal + rightVal;
      } else if (currentVal instanceof Date && typeof rightVal === 'number') {
        // Date addition in days
        const d = new Date(currentVal.getTime());
        d.setDate(d.getDate() + rightVal);
        this.variables[varName] = d;
      } else {
        this.variables[varName] = String(currentVal ?? '') + String(rightVal ?? '');
      }
    } else if (op === '-=') {
      if (typeof currentVal === 'number' && typeof rightVal === 'number') {
        this.variables[varName] = currentVal - rightVal;
      } else if (currentVal instanceof Date && typeof rightVal === 'number') {
        const d = new Date(currentVal.getTime());
        d.setDate(d.getDate() - rightVal);
        this.variables[varName] = d;
      } else {
        this.variables[varName] = (Number(currentVal) || 0) - (Number(rightVal) || 0);
      }
    } else {
      this.variables[varName] = rightVal;
    }
  }

  /**
   * Evaluates expressions with support for precedence:
   * Logical: and, or, !
   * Relational: =, !=, <, <=, >, >=
   * Arithmetic: +, -, *, /, %, ^
   */
  public evaluateExpression(expr: string): any {
    const trimmed = expr.trim();
    if (!trimmed) return '';

    // Literals: NULL
    if (trimmed.toUpperCase() === 'NULL') return null;

    // Boolean literals
    if (trimmed.toUpperCase() === 'TRUE') return true;
    if (trimmed.toUpperCase() === 'FALSE') return false;

    // String literal: "..." (with "" escaped quotes)
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }

    // Date literal: #...#
    if (trimmed.startsWith('#') && trimmed.endsWith('#') && trimmed.length >= 2) {
      return this.parseDateLiteral(trimmed);
    }

    // Number literal
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Braced database column identifier: {purchase date}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const colName = trimmed.slice(1, -1).trim();
      return this.lookupVariable(colName);
    }

    // Function call: funcName(arg1, arg2)
    const funcMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\(([\s\S]*)\)$/);
    if (funcMatch) {
      const funcName = funcMatch[1].toLowerCase();
      const rawArgs = this.splitByComma(funcMatch[2]);
      const evalArgs = rawArgs.map(arg => this.evaluateExpression(arg));

      // Builtin function
      if (GMERGE_BUILTIN_FUNCTIONS[funcName]) {
        return GMERGE_BUILTIN_FUNCTIONS[funcName](...evalArgs);
      }

      // User function
      if (this.userFunctions[funcName]) {
        const uFunc = this.userFunctions[funcName];
        const localVars = { ...this.variables };
        uFunc.params.forEach((paramName, idx) => {
          localVars[paramName] = evalArgs[idx];
        });
        const subEval = new ExpressionEvaluator({ ...this.context, userFunctions: this.userFunctions }, localVars);
        return subEval.evaluateExpression(uFunc.body);
      }
    }

    // Parentheses ( ... )
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const inner = trimmed.slice(1, -1).trim();
      return this.evaluateExpression(inner);
    }

    // Binary Logical OR
    const orIdx = this.findOperator(trimmed, [' or ', '||']);
    if (orIdx > 0) {
      const left = this.evaluateExpression(trimmed.slice(0, orIdx));
      const right = this.evaluateExpression(trimmed.slice(orIdx + (trimmed.slice(orIdx).startsWith('||') ? 2 : 4)));
      return Boolean(left || right);
    }

    // Binary Logical AND
    const andIdx = this.findOperator(trimmed, [' and ', '&&']);
    if (andIdx > 0) {
      const left = this.evaluateExpression(trimmed.slice(0, andIdx));
      const right = this.evaluateExpression(trimmed.slice(andIdx + (trimmed.slice(andIdx).startsWith('&&') ? 2 : 5)));
      return Boolean(left && right);
    }

    // Relational Operators: =, !=, <=, >=, <, >
    const relOps = ['!=', '<=', '>=', '<', '>', '='];
    for (const op of relOps) {
      const opIdx = this.findOperator(trimmed, [op]);
      if (opIdx > 0) {
        const left = this.evaluateExpression(trimmed.slice(0, opIdx));
        const right = this.evaluateExpression(trimmed.slice(opIdx + op.length));
        return this.compareValues(left, right, op);
      }
    }

    // Binary Addition & Subtraction (+, -)
    const addSubIdx = this.findAddSubOperator(trimmed);
    if (addSubIdx > 0) {
      const op = trimmed[addSubIdx];
      const left = this.evaluateExpression(trimmed.slice(0, addSubIdx));
      const right = this.evaluateExpression(trimmed.slice(addSubIdx + 1));

      if (op === '+') {
        if (left instanceof Date && typeof right === 'number') {
          const d = new Date(left.getTime());
          d.setDate(d.getDate() + right);
          return d;
        }
        if (typeof left === 'number' && typeof right === 'number') {
          return left + right;
        }
        return String(left ?? '') + String(right ?? '');
      } else {
        if (left instanceof Date && right instanceof Date) {
          // Date difference in days
          const diffMs = left.getTime() - right.getTime();
          return Math.round(diffMs / (1000 * 60 * 60 * 24));
        }
        if (left instanceof Date && typeof right === 'number') {
          const d = new Date(left.getTime());
          d.setDate(d.getDate() - right);
          return d;
        }
        return (Number(left) || 0) - (Number(right) || 0);
      }
    }

    // Multiplication, Division, Modulo (*, /, %)
    const mulDivIdx = this.findOperator(trimmed, ['*', '/', '%']);
    if (mulDivIdx > 0) {
      const op = trimmed[mulDivIdx];
      const left = Number(this.evaluateExpression(trimmed.slice(0, mulDivIdx))) || 0;
      const right = Number(this.evaluateExpression(trimmed.slice(mulDivIdx + 1))) || 0;
      if (op === '*') return left * right;
      if (op === '/') return right !== 0 ? left / right : 0;
      if (op === '%') return right !== 0 ? left % right : 0;
    }

    // Power (^)
    const powIdx = this.findOperator(trimmed, ['^']);
    if (powIdx > 0) {
      const left = Number(this.evaluateExpression(trimmed.slice(0, powIdx))) || 0;
      const right = Number(this.evaluateExpression(trimmed.slice(powIdx + 1))) || 0;
      return Math.pow(left, right);
    }

    // Unary NOT (!)
    if (trimmed.startsWith('!')) {
      return !this.evaluateExpression(trimmed.slice(1));
    }

    // Variable or column identifier
    return this.lookupVariable(trimmed);
  }

  private compareValues(left: any, right: any, op: string): boolean {
    if (left instanceof Date && right instanceof Date) {
      const lt = left.getTime();
      const rt = right.getTime();
      if (op === '=') return lt === rt;
      if (op === '!=') return lt !== rt;
      if (op === '<') return lt < rt;
      if (op === '<=') return lt <= rt;
      if (op === '>') return lt > rt;
      if (op === '>=') return lt >= rt;
    }

    // Convert booleans
    if (typeof left === 'boolean' || typeof right === 'boolean') {
      const lb = Boolean(left);
      const rb = Boolean(right);
      return op === '=' ? lb === rb : lb !== rb;
    }

    // Numeric comparison if both numeric
    if (!isNaN(Number(left)) && !isNaN(Number(right)) && left !== '' && right !== '') {
      const nL = Number(left);
      const nR = Number(right);
      if (op === '=') return nL === nR;
      if (op === '!=') return nL !== nR;
      if (op === '<') return nL < nR;
      if (op === '<=') return nL <= nR;
      if (op === '>') return nL > nR;
      if (op === '>=') return nL >= nR;
    }

    // String comparison (case-insensitive for equality as in G-Merge)
    const sL = String(left ?? '').toLowerCase();
    const sR = String(right ?? '').toLowerCase();
    if (op === '=') return sL === sR;
    if (op === '!=') return sL !== sR;
    if (op === '<') return sL < sR;
    if (op === '<=') return sL <= sR;
    if (op === '>') return sL > sR;
    if (op === '>=') return sL >= sR;
    return false;
  }

  private parseDateLiteral(literal: string): Date {
    const raw = literal.replace(/^#|#$/g, '').trim();
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;

    // Fallback: try parsing formats like 10/15/1999 5:03pm
    return new Date();
  }

  private lookupVariable(name: string): any {
    const trimmed = name.trim();

    // Check user defined local variables
    if (this.variables[trimmed] !== undefined) {
      return this.variables[trimmed];
    }

    const rec = this.context.recipient || { email: 'user@example.com' };
    const custom = this.context.customColumns || {};

    // Predefined Variables (-Variable-)
    const lower = trimmed.toLowerCase();
    if (lower === '-email-') return rec.email || '';
    if (lower === '-firstname-') {
      if (rec.firstName) return rec.firstName;
      if (rec.name) return rec.name.split(/\s+/)[0] || '';
      return '';
    }
    if (lower === '-lastname-') {
      if (rec.lastName) return rec.lastName;
      if (rec.name) {
        const parts = rec.name.split(/\s+/);
        return parts.length > 1 ? parts.slice(1).join(' ') : '';
      }
      return '';
    }
    if (lower === '-fullname-') return rec.name || rec.firstName || '';
    if (lower === '-company-') return rec.company || '';
    if (lower === '-domain-') {
      if (rec.domain) return rec.domain;
      if (rec.email && rec.email.includes('@')) return rec.email.split('@')[1];
      return '';
    }
    if (lower === '-index-') return rec.index !== undefined ? rec.index : 1;
    if (lower === '-messageid-') return this.context.messageId || `<${Date.now()}@relay.mail>`;
    if (lower === '-now-') return this.context.now || new Date();
    if (lower === '-operationtype-') return this.context.operationType || 1;
    if (lower === '-recipient-') {
      if (rec.compoundRecipient) return rec.compoundRecipient;
      return rec.name ? `"${rec.name}" <${rec.email}>` : rec.email;
    }
    if (lower === '-tid-') return rec.tid || rec.id || '1001';
    if (lower === '-user-') {
      if (rec.email && rec.email.includes('@')) return rec.email.split('@')[0];
      return '';
    }
    if (trimmed === 'CR') return '\r\n';

    // Custom database column matching
    if (custom[trimmed] !== undefined) return custom[trimmed];
    if (rec[trimmed] !== undefined) return rec[trimmed];

    // Case-insensitive custom column search
    for (const [k, v] of Object.entries(custom)) {
      if (k.toLowerCase() === lower) return v;
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k.toLowerCase() === lower) return v;
    }

    return '';
  }

  private splitByComma(str: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let parenDepth = 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === '(' && !inQuotes) parenDepth++;
      else if (ch === ')' && !inQuotes) parenDepth--;
      else if (ch === ',' && !inQuotes && parenDepth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) result.push(current.trim());
    return result;
  }

  private findUnquotedChar(str: string, targetChar: string): number {
    let inQuotes = false;
    let parenDepth = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === '(' && !inQuotes) parenDepth++;
      else if (ch === ')' && !inQuotes) parenDepth--;
      else if (ch === targetChar && !inQuotes && parenDepth === 0) {
        return i;
      }
    }
    return -1;
  }

  private findOperator(str: string, ops: string[]): number {
    let inQuotes = false;
    let parenDepth = 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === '(' && !inQuotes) parenDepth++;
      else if (ch === ')' && !inQuotes) parenDepth--;
      else if (!inQuotes && parenDepth === 0) {
        for (const op of ops) {
          if (str.slice(i, i + op.length) === op) {
            return i;
          }
        }
      }
    }
    return -1;
  }

  private findAddSubOperator(str: string): number {
    let inQuotes = false;
    let parenDepth = 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === '(' && !inQuotes) parenDepth++;
      else if (ch === ')' && !inQuotes) parenDepth--;
      else if (!inQuotes && parenDepth === 0) {
        if ((ch === '+' || ch === '-') && i > 0 && str[i - 1] !== ' ' && str[i + 1] !== ' ') {
          // Could be inside identifier or number
        }
        if ((ch === '+' || ch === '-') && i > 0 && !['+', '-', '*', '/', '%', '(', '<', '>', '=', '!'].includes(str[i - 1])) {
          return i;
        }
      }
    }
    return -1;
  }
}

/**
 * Main G-Merge Template Processing Engine
 */
export function evaluateGMergeTemplate(
  template: string,
  context: GMergeContext = {}
): GMergeEvaluationResult {
  const startTime = performance.now();
  const errors: string[] = [];
  const variables: Record<string, any> = { ...(context.variables || {}) };
  const userFunctions: Record<string, { params: string[]; body: string }> = { ...(context.userFunctions || {}) };

  if (!template) {
    return {
      output: '',
      variables,
      errors: [],
      executionTimeMs: 0
    };
  }

  // Handle escape: [[[ -> placeholder for literal [[
  const ESCAPE_PLACEHOLDER = `__GMERGE_LITERAL_BRACKET_${Date.now()}__`;
  let processed = template.replace(/\[\[\[/g, ESCAPE_PLACEHOLDER);

  const evaluator = new ExpressionEvaluator({ ...context, userFunctions }, variables);

  /**
   * Process conditional blocks: [[if <cond>]] ... [[elseif <cond2>]] ... [[else]] ... [[endif]]
   */
  function processConditionals(input: string): string {
    const ifRegex = /\[\[if\s+([\s\S]*?)\]\]([\s\S]*?)\[\[endif\]\]/gi;
    return input.replace(ifRegex, (match, conditionExpr, bodyContent) => {
      try {
        // Check for block comment out [[if FALSE]]
        if (conditionExpr.trim().toUpperCase() === 'FALSE') {
          // Check if there is an else or elseif
          const branches = splitConditionalBranches(bodyContent);
          for (const branch of branches) {
            if (branch.type === 'elseif') {
              const cond = evaluator.evaluateExpression(branch.condition || '');
              if (cond) return processConditionals(branch.content);
            } else if (branch.type === 'else') {
              return processConditionals(branch.content);
            }
          }
          return '';
        }

        const isTrue = evaluator.evaluateExpression(conditionExpr);
        const branches = splitConditionalBranches(bodyContent);

        if (isTrue) {
          // Return the main 'if' branch content
          return processConditionals(branches[0]?.content || '');
        }

        // Evaluate elseif / else branches
        for (let b = 1; b < branches.length; b++) {
          const branch = branches[b];
          if (branch.type === 'elseif') {
            const condResult = evaluator.evaluateExpression(branch.condition || '');
            if (condResult) {
              return processConditionals(branch.content);
            }
          } else if (branch.type === 'else') {
            return processConditionals(branch.content);
          }
        }
        return '';
      } catch (err: any) {
        errors.push(`Error evaluating condition '[[if ${conditionExpr}]]': ${err.message}`);
        return '';
      }
    });
  }

  function splitConditionalBranches(body: string) {
    const branches: Array<{ type: 'if' | 'elseif' | 'else'; condition?: string; content: string }> = [];
    const tokens = body.split(/(\[\[elseif\s+[\s\S]*?\]\]|\[\[else\]\])/i);

    let currentType: 'if' | 'elseif' | 'else' = 'if';
    let currentCondition: string | undefined = undefined;

    for (const token of tokens) {
      if (token.toLowerCase().startsWith('[[elseif')) {
        const condMatch = token.match(/\[\[elseif\s+([\s\S]*?)\]\]/i);
        currentType = 'elseif';
        currentCondition = condMatch ? condMatch[1].trim() : '';
      } else if (token.toLowerCase() === '[[else]]') {
        currentType = 'else';
        currentCondition = undefined;
      } else {
        branches.push({
          type: currentType,
          condition: currentCondition,
          content: token
        });
      }
    }
    return branches;
  }

  // 1. Process nested conditionals
  let passCount = 0;
  while (/\[\[if\s+[\s\S]*?\]\]/i.test(processed) && passCount < 10) {
    processed = processConditionals(processed);
    passCount++;
  }

  // 2. Process all remaining inline statements: [[ ... ]]
  const statementRegex = /\[\[([\s\S]*?)\]\]/g;
  processed = processed.replace(statementRegex, (match, innerStmt) => {
    try {
      // Check for compound semicolon-delimited statements: [[12; 34]] or [[var s="foo"; s]]
      if (innerStmt.includes(';')) {
        const statements = innerStmt.split(';').map((s: string) => s.trim()).filter(Boolean);
        let compoundOutput = '';
        for (const sub of statements) {
          const res = evaluator.evaluateStatement(sub);
          if (res !== undefined && res !== null && res !== '') {
            compoundOutput += res instanceof Date ? formatGMergeDate(res, '') : String(res);
          }
        }
        return compoundOutput;
      }

      const evalResult = evaluator.evaluateStatement(innerStmt);
      if (evalResult === undefined || evalResult === null) return '';
      if (evalResult instanceof Date) {
        return formatGMergeDate(evalResult, '');
      }
      return String(evalResult);
    } catch (err: any) {
      errors.push(`Error executing G-Merge statement '[[${innerStmt}]]': ${err.message}`);
      return `[[${innerStmt}]]`;
    }
  });

  // Restore escaped literal brackets
  processed = processed.split(ESCAPE_PLACEHOLDER).join('[[');

  const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    output: processed,
    variables: evaluator.getVariables(),
    errors,
    executionTimeMs
  };
}
