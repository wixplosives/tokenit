import { tokenize, createToken, Token, Seeker, getText, last } from '@tokey/core';

type RangeMultipliers = '!' | '?' | '+' | '*';

type Delimiters =
    | '<'
    | '>'
    | '['
    | ']'
    | ','
    | '/'
    | '|'
    | '&'
    | '#'
    | '('
    | ')'
    | '{'
    | '}'
    | RangeMultipliers;

/**
 * Add comments
 * allOf, oneOf, anyOf
 */

const isDelimiter = (char: string) =>
    char === '<' ||
    char === '>' ||
    char === '[' ||
    char === ']' ||
    char === ',' ||
    char === '/' ||
    char === '|' ||
    char === '&' ||
    char === '#' ||
    char === '(' ||
    char === ')' ||
    char === '{' ||
    char === '}' ||
    char === '?' ||
    char === '!' ||
    char === '*' ||
    char === '+';

type ValueSyntaxToken = Token<'space' | 'text' | Delimiters>;

export const isWhitespace = (char: string) =>
    char === ' ' || char === `\t` || char === `\r` || char === '\n' || char === '\f';

export function parseValueSyntax(source: string) {
    return parseTokens(
        tokenize<ValueSyntaxToken>(source, {
            isDelimiter,
            isWhitespace,
            createToken,
            isStringDelimiter: () => false,
            shouldAddToken: () => true,
            getCommentStartType: () => '',
            isCommentEnd: () => false,
            getUnclosedComment: () => '',
        }),
        source,
    );
}

export type Range = [min: number, max: number];

export interface Multipliers {
    range?: Range;
    list?: boolean;
}

export interface DataTypeNode {
    type: 'data-type';
    name: string;
    range?: Range;
    multipliers?: Multipliers;
}

export interface PropertyNode {
    type: 'property';
    name: string;
    range?: Range;
    multipliers?: Multipliers;
}

export interface LiteralNode {
    type: 'literal';
    name: string;
    enclosed: boolean;
    multipliers?: Multipliers;
}

export interface KeywordNode {
    type: 'keyword';
    name: string;
    multipliers?: Multipliers;
}

export interface CombinatorGroup {
    nodes: ValueSyntaxAstNode[];
}

export interface JuxtaposingNode extends CombinatorGroup {
    type: 'juxtaposing';
}

export interface DoubleAmpersandNode extends CombinatorGroup {
    type: '&&';
}

export interface DoubleBarNode extends CombinatorGroup {
    type: '||';
}

export interface BarNode extends CombinatorGroup {
    type: '|';
}

export interface GroupNode extends CombinatorGroup {
    type: 'group';
    multipliers?: Multipliers;
}

export type Combinators =
    | GroupNode
    | JuxtaposingNode
    | DoubleAmpersandNode
    | DoubleBarNode
    | BarNode;

export type Components = DataTypeNode | PropertyNode;
export type ValueSyntaxAstNode = Components | KeywordNode | LiteralNode | Combinators;

export function literal(name: string, enclosed = false, multipliers?: Multipliers): LiteralNode {
    return { type: 'literal', name, enclosed, multipliers };
}

export function keyword(name: string, multipliers?: Multipliers): KeywordNode {
    return { type: 'keyword', name, multipliers };
}

export function property(name: string, range?: Range, multipliers?: Multipliers): PropertyNode {
    return { type: 'property', name, range, multipliers };
}

export function dataType(name: string, range?: Range, multipliers?: Multipliers): DataTypeNode {
    return { type: 'data-type', name, range, multipliers };
}

export function group(nodes: ValueSyntaxAstNode[], multipliers?: Multipliers): GroupNode {
    return { type: 'group', nodes, multipliers };
}

export function juxtaposing(nodes: ValueSyntaxAstNode[]): JuxtaposingNode {
    return { type: 'juxtaposing', nodes };
}

export function bar(nodes: ValueSyntaxAstNode[]): BarNode {
    return { type: '|', nodes };
}

export function doubleAmpersand(nodes: ValueSyntaxAstNode[]): DoubleAmpersandNode {
    return { type: '&&', nodes };
}

export function doubleBar(nodes: ValueSyntaxAstNode[]): DoubleBarNode {
    return { type: '||', nodes };
}

interface ParsingContext {
    ast: ValueSyntaxAstNode[];
}

function parseTokens(tokens: ValueSyntaxToken[], source: string) {
    const handleToken = (
        token: ValueSyntaxToken,
        { ast }: ParsingContext,
        _source: string,
        s: Seeker<ValueSyntaxToken>,
    ) => {
        if (token.type === '<') {
            let closed = false;
            s.eat('space');
            const nameBlock = s.run<ValueSyntaxToken[]>(
                (node, ast) => {
                    const { type } = node;
                    if (type === 'space' || type === '[' || type === '>') {
                        return false;
                    } else {
                        ast.push(node);
                        return;
                    }
                },
                [],
                _source,
            );
            if (nameBlock.length === 0) {
                throw new Error('missing data type name');
            }
            s.back();
            const name = getText(nameBlock, undefined, undefined, source);

            const type = getLiteralValueType(name);
            let range: Range | undefined;
            if (type === 'invalid') {
                throw new Error('missing data type name');
            } else {
                const t = s.eat('space').next();
                if (t.type === '>') {
                    closed = true;
                } else if (t.type === '[') {
                    const min = s.eat('space').take('text');
                    const sep = s.eat('space').take(',');
                    const max = s.eat('space').take('text');
                    const end = s.eat('space').take(']');
                    if (min && sep && max && end) {
                        range = [parseNumber(min.value), parseNumber(max.value)];
                    } else {
                        throw new Error('Invalid range');
                    }
                    const t = s.eat('space').take('>');
                    if (t) {
                        closed = true;
                    }
                }
            }
            if (!closed) {
                throw new Error('missing ">"');
            }
            if (type === 'quoted') {
                ast.push(property(name.slice(1, -1), range));
            } else {
                ast.push(dataType(name, range));
            }
        } else if (token.type === '[') {
            const res = s.run(handleToken, { ast: [] }, source);
            applyPrecedence(res.ast);
            ast.push(group(res.ast));
        } else if (token.type === ']') {
            return false;
        } else if (token.type === 'text') {
            const t = getLiteralValueType(token.value);
            if (t === 'invalid') {
                if (token.value.startsWith("'")) {
                    const tokens = s.run(
                        (token, ast) => {
                            ast.push(token);
                            return token.value.endsWith("'") ? false : undefined;
                        },
                        [token] as ValueSyntaxToken[],
                        source,
                    );
                    if (tokens.length <= 2) {
                        throw new Error('unclosed or empty literal');
                    } else {
                        ast.push(
                            literal(
                                getText(tokens, undefined, undefined, source).slice(1, -1),
                                true,
                            ),
                        );
                    }
                } else {
                    throw new Error('invalid literal');
                }
            } else if (t === 'quoted') {
                ast.push(literal(token.value.slice(1, -1), true));
            } else {
                ast.push(keyword(token.value));
            }
        } else if (
            token.type === ',' ||
            token.type === '/' ||
            token.type === '(' ||
            token.type === ')'
        ) {
            ast.push(literal(token.value));
        } else if (token.type === 'space') {
            s.eat('space');
        } else if (isRangeMultiplier(token)) {
            const node = lastParsedNode(ast);
            if (!node || node.type === 'juxtaposing' || isLowLevelGroup(node)) {
                throw new Error('unexpected modifier');
            }
            node.multipliers ??= {};
            if (node.multipliers.range) {
                throw new Error('multiple multipliers on same node');
            }
            node.multipliers.range = typeToRange(token.type);
        } else if (token.type === '{') {
            if (s.peekBack().type === 'space') {
                ast.push(literal(token.value, false));
            } else {
                const node = lastParsedNode(ast);

                if (!node || isLowLevelGroup(node) || node.type === 'juxtaposing') {
                    throw new Error('unexpected range modifier');
                }

                const start = s.eat('space').take('text');
                if (!start) {
                    throw new Error('missing range start value');
                }
                const sep = s.eat('space').take(',');
                if (sep) {
                    const end = s.eat('space').take('text');
                    const close = s.eat('space').take('}');
                    if (!close) {
                        throw new Error('missing }');
                    }

                    node.multipliers ??= {};
                    if (node.multipliers.range) {
                        throw new Error('multiple multipliers on same node');
                    }
                    node.multipliers.range = [
                        parseNumber(start.value),
                        parseNumber(end?.value ?? '∞'),
                    ];
                } else {
                    const close = s.eat('space').take('}');
                    if (!close) {
                        throw new Error('missing }');
                    }
                    node.multipliers ??= {};
                    if (node.multipliers.range) {
                        throw new Error('multiple multipliers on same node');
                    }
                    node.multipliers.range = [parseNumber(start.value), parseNumber(start.value)];
                }
            }
        } else if (token.type === '#') {
            const node = lastParsedNode(ast);
            if (!node || node.type === 'juxtaposing' || isLowLevelGroup(node)) {
                throw new Error('unexpected list modifier');
            }
            node.multipliers ??= {};
            node.multipliers.list = true;
        } else if (token.type === '&') {
            const nextAnd = s.take('&');
            if (!nextAnd) {
                throw new Error('missing &');
            }
            ast.push(doubleAmpersand([]));
        } else if (token.type === '|') {
            ast.push(s.take('|') ? doubleBar([]) : bar([]));
        } else if (token.type === '}') {
            ast.push(literal(token.value, false));
        } else {
            throw new Error(`UnHandled ${JSON.stringify(token)}`);
        }

        applyJuxtaposing(ast);

        return;
    };

    const results = new Seeker(tokens).run<ParsingContext>(handleToken, { ast: [] }, source);

    applyPrecedence(results.ast);

    return results.ast[0];
}

function lastParsedNode(ast: ValueSyntaxAstNode[]) {
    const node = last(ast);
    // assume the parse process in juxtaposing on each step
    return node?.type === 'juxtaposing' ? last(node.nodes) : node;
}

function applyPrecedence(ast: ValueSyntaxAstNode[]) {
    const order = ['&&', '||', '|'] as const;

    for (let i = 0; i < order.length; i++) {
        const type = order[i];
        for (let j = 0; j < ast.length; j++) {
            const node = ast[j];
            if (node.type === type) {
                const before = ast[j - 1];
                const after = ast[j + 1];
                if (!before) {
                    throw new Error(`missing node before ${type}`);
                }
                if (!after) {
                    throw new Error(`missing node after ${type}`);
                }
                if (after.type === type) {
                    throw new Error('invalid grouping');
                }
                if (before.type === type) {
                    before.nodes.push(after);
                    ast.splice(j - 1, 3, before);
                } else {
                    node.nodes.push(before, after);
                    ast.splice(j - 1, 3, node);
                }
                j--;
            }
        }
    }

    if (ast.length > 1) {
        throw new Error('could not applyPrecedence');
    }
}

function parseNumber(value: string): number {
    if (value === '∞') {
        return Infinity;
    }
    if (value === `-∞`) {
        return -Infinity;
    }
    // TODO: check for valid number, NaN, more...
    return parseFloat(value);
}

function isRangeMultiplier(token: ValueSyntaxToken): token is Token<RangeMultipliers> {
    const { type } = token;
    return type === '!' || type === '?' || type === '+' || type === '*';
}

function typeToRange(type: RangeMultipliers): [number, number] {
    switch (type) {
        case '!':
            return [1, 1];
        case '*':
            return [0, Infinity];
        case '+':
            return [1, Infinity];
        case '?':
            return [0, 1];
    }
}

function applyJuxtaposing(ast: ValueSyntaxAstNode[]) {
    if (ast.length > 1) {
        const last = ast[ast.length - 1];
        const prev = ast[ast.length - 2];
        if (prev.type === 'juxtaposing' && !isLowLevelGroup(last)) {
            ast.length = ast.length - 1;
            prev.nodes.push(last);
        } else if (!isLowLevelGroup(prev) && !isLowLevelGroup(last)) {
            ast.splice(ast.length - 2, 2, juxtaposing([prev, last]));
        }
    }
}

function isLowLevelGroup(
    node: ValueSyntaxAstNode,
): node is DoubleBarNode | DoubleAmpersandNode | BarNode {
    const { type } = node;
    return type === '&&' || type === '|' || type === '||';
}

export function stringify(node: ValueSyntaxAstNode): string {
    const { type } = node;
    if ('multipliers' in node) {
        throw new Error('TODO: multipliers');
    }
    if (type === 'property') {
        return `<'${node.name}'${node.range ? ` [${node.range[0]}, ${node.range[1]}]` : ''}>`;
    } else if (type === 'data-type') {
        return `<${node.name}${node.range ? ` [${node.range[0]}, ${node.range[1]}]` : ''}>`;
    } else if (type === 'literal') {
        return node.enclosed ? `'${node.name}'` : `${node.name}`;
    } else if (type === 'group') {
        return `[ ${node.nodes.map((child) => stringify(child)).join('')} ]`;
    } else if (type === '&&') {
        return node.nodes.map((child) => stringify(child)).join(' && ');
    } else if (type === '||') {
        return node.nodes.map((child) => stringify(child)).join(' || ');
    } else if (type === '|') {
        return node.nodes.map((child) => stringify(child)).join(' | ');
    } else if (type === 'juxtaposing') {
        return node.nodes.map((child) => stringify(child)).join(' ');
    } else if (type === 'keyword') {
        return node.name;
    } else {
        throw new Error(`missing stringify for node ${JSON.stringify(node)}`);
    }
}

function getLiteralValueType(value: string) {
    if (value.startsWith("'")) {
        if (value.endsWith("'") && value.length > 1) {
            return 'quoted';
        } else {
            return 'invalid';
        }
    } else {
        return 'literal';
    }
}
