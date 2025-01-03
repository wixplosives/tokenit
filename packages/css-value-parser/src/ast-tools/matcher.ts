import type { BaseAstNode } from '../ast-types';
import type {
    ValueSyntaxAstNode,
    DataTypeNode,
    KeywordNode,
    Combinators,
    JuxtaposingNode,
    BarNode,
    DoubleBarNode,
} from '../value-syntax-parser';
import { combinationIterator, CombinationGenerator } from './matcher-iterator';

interface MatchOptions {
    type: `valid` | `ambiguous`;
    customIdentExclude: string[];
    composedSyntax: Record<string, ValueSyntaxAstNode>;
}
interface Match {
    syntax: ValueSyntaxAstNode;
    value: BaseAstNode[];
}
interface MatchResult {
    isValid: boolean;
    errors: any[];
    matches: Match[];
}
const defaultOptions: MatchOptions = {
    type: `valid`,
    customIdentExclude: [],
    composedSyntax: {},
};
export function match(
    value: BaseAstNode[],
    syntax: ValueSyntaxAstNode,
    options: Partial<MatchOptions> = {}
): MatchResult {
    const _options: MatchOptions = { ...defaultOptions, ...options };
    const matcher = createMatcher(value, syntax);
    let isSearching = true;
    while (isSearching) {
        matcher.forward();
        const { isValid } = matcher.test(_options);
        const valueMatchedSize = matcher.matchedSize();
        if (matcher.isExhausted()) {
            // matcher run through all combinations
            isSearching = false;
            if (valueMatchedSize < value.length - 1) {
                if (isValid) {
                    // more value to the syntax: report value overflow
                    matcher.result.isValid = false;
                    matcher.result.errors.length = 0;
                    matcher.result.errors.push({ type: `valueOverflow` });
                    matcher.result.matches.length = 0;
                }
            }
        } else {
            // matcher has more combinations
            if (isValid) {
                if (valueMatchedSize === value.length) {
                    // found match!
                    isSearching = false;
                    // ToDo: handle claims
                }
            } else {
                // ToDo: end-of-input case
            }
        }
    }

    return matcher.result;
}
/*** matchers ***/
class BaseMatcher<
    PROGRESS extends Record<string, any> = any,
    SYNTAX extends ValueSyntaxAstNode = any
> {
    public isMatched = false;
    public valueRange: [start: number, end: number] = [0, 0];
    public progress = {} as PROGRESS;
    public result = defaultMatchResult();
    constructor(public value: BaseAstNode[], public syntax: SYNTAX) {
        this.init();
    }
    public init() {
        /**/
    }
    public forward() {
        /**/
    }
    public trackBack() {
        //
    }
    public setValueStartIndex(valueStartIndex: number) {
        // maybe reset?
        this.valueRange[0] = valueStartIndex;
        this.valueRange[1] = valueStartIndex;
    }
    public test(_options: MatchOptions): MatchResult {
        this.isMatched = true;
        // skip spaces
        let valueStartIndex = this.valueRange[1];
        while (this.value[valueStartIndex].type === `space`) {
            valueStartIndex++;
        }
        this.valueRange[1] = valueStartIndex;
        return this.result;
    }
    public isExhausted(): boolean {
        // stop if not override
        return true;
    }
    public matchedSize() {
        return this.valueRange[1] - this.valueRange[0];
    }
    //
    protected addMatch(syntax: ValueSyntaxAstNode, value: BaseAstNode[]) {
        this.result.matches.push({ syntax, value });
    }
    protected appendMatch(syntax: ValueSyntaxAstNode, value: BaseAstNode[]) {
        const { matches } = this.result;
        const lastMatch = matches[matches.length - 1];
        if (lastMatch && lastMatch.syntax === syntax) {
            lastMatch.value.push(...value);
        } else {
            matches.push({ syntax, value });
        }
    }
}

class SingleMatcher<SYNTAX extends ValueSyntaxAstNode> extends BaseMatcher<
    { index: number; isDone: boolean },
    SYNTAX
> {
    init() {
        this.progress.index = 0;
        this.progress.isDone = false;
    }
    isExhausted() {
        return this.isMatched;
    }
}
class DataTypeMatcher extends SingleMatcher<DataTypeNode> {
    // isDone() {
    //   if (this.progress.isDone) {
    //     return true;
    //   }
    //   const { multipliers } = this.syntax;
    //   if (multipliers?.range) {
    //     // const [min, max] = multipliers.range;
    //     return false;
    //   }
    //   return super.isDone();
    // }
    test(options: MatchOptions) {
        super.test(options);
        const syntax = this.syntax;
        const valueStartIndex = this.valueRange[1];
        const valueNode = this.value[valueStartIndex];
        const acceptableValue = isAcceptedAsType(valueNode.type, syntax.name);
        if (acceptableValue) {
            this.valueRange[1] = valueStartIndex + 1;
            this.result.isValid = true;
            // this.result.matches.push({ syntax, value: [valueNode] });
            this.appendMatch(syntax, [valueNode]);
        } else {
            if (this.result.matches.length) {
                this.progress.isDone = true;
            } else {
                this.progress.isDone = true;
                this.result.errors.length = 0;
                this.result.errors.push({ type: `mismatch`, syntax });
            }
        }
        return this.result;
    }
}
class KeywordMatcher extends SingleMatcher<KeywordNode> {
    test(options: MatchOptions) {
        super.test(options);
        const syntax = this.syntax;
        const valueStartIndex = this.valueRange[1];
        const valueNode = this.value[valueStartIndex];
        if (
            valueNode.type === `<custom-ident>` &&
            valueNode.value.toLowerCase() === syntax.name.toLowerCase()
        ) {
            this.valueRange[1] = valueStartIndex + 1;
            this.result.isValid = true;
            this.result.matches.push({ syntax, value: [valueNode] });
        } else {
            this.result.errors.length = 0;
            this.result.errors.push({ type: `mismatch`, syntax });
        }
        return this.result;
    }
}

class MultiMatcher<
    SYNTAX extends Combinators,
    PROGRESS extends Record<string, any>
> extends BaseMatcher<PROGRESS, SYNTAX> {
    protected matchers!: BaseMatcher<any, any>[];
    init() {
        this.matchers = this.syntax.nodes.map((subSyntax) => {
            return createMatcher(this.value, subSyntax);
        });
    }
}
class JuxtaposedMatcher extends MultiMatcher<JuxtaposingNode, { index: number }> {
    init() {
        super.init();
        this.progress.index = 0;
    }
    forward() {
        this.progress.index = 0;
        for (const matcher of this.matchers) {
            if (!matcher.isExhausted()) {
                matcher.forward();
                break;
            }
            this.progress.index++;
        }
    }
    test(options: MatchOptions) {
        super.test(options);
        const syntax = this.syntax;
        const valueStartIndex = this.valueRange[1];
        const progress = this.progress;
        this.result.errors.length = 0;
        const subIndex = progress.index;
        const isLast = subIndex === this.matchers.length - 1;
        const subMatcher = this.matchers[subIndex];
        subMatcher.setValueStartIndex(valueStartIndex);
        subMatcher.test(options);
        const subMatch = subMatcher.result;
        if (subMatch.isValid) {
            this.valueRange[1] = subMatcher.valueRange[1];
            this.result.matches.push(
                ...subMatch.matches.map(({ value, syntax }) => ({ value, syntax }))
            );
            if (isLast) {
                this.result.isValid = true;
            }
        } else {
            // collect errors
            this.result.errors.push({
                type: `mismatch`,
                syntax,
            });
        }
        return this.result;
    }
    isExhausted() {
        const index = this.progress.index;
        const isInBounds = index < this.syntax.nodes.length;
        if (!isInBounds) {
            // out of bound error
            return true;
        }
        const isInLast = index === this.syntax.nodes.length - 1;
        const currentMatcher = this.matchers[index];
        const isDone = currentMatcher.isExhausted();
        const isValid = currentMatcher.result.isValid;
        if (isDone && !isValid) {
            return true;
        }
        return isInLast && isDone;
    }
}
class OneOfMatcher extends MultiMatcher<BarNode, { index: number }> {
    init() {
        super.init();
        this.progress.index = 0;
    }
    forward() {
        const prevIndex = this.progress.index;
        this.progress.index = 0;
        for (const matcher of this.matchers) {
            if (!matcher.isExhausted()) {
                matcher.forward();
                break;
            }
            this.progress.index++;
        }
        if (prevIndex !== this.progress.index) {
            this.valueRange[1] = this.valueRange[0];
        }
    }
    test(options: MatchOptions) {
        super.test(options);
        const syntax = this.syntax;
        const valueStartIndex = this.valueRange[1];
        const progress = this.progress;

        const subIndex = progress.index;
        const subMatcher = this.matchers[subIndex];
        subMatcher.test(options);
        const subMatch = subMatcher.result;
        this.result.errors.length = 0;
        this.result.matches.length = 0;
        if (subMatch.isValid) {
            this.valueRange[1] = valueStartIndex + subMatcher.matchedSize();
            this.result.isValid = true;
            this.result.matches.push(
                ...subMatch.matches.map(({ value, syntax }) => ({ value, syntax }))
            );
        } else {
            this.result.isValid = false;
            this.valueRange[1] = valueStartIndex;
        }
        if (subIndex >= this.matchers.length - 1) {
            if (!this.result.isValid) {
                // should filter valid sub syntax(s)
                this.result.errors.push({
                    type: `mismatch`,
                    syntax: syntax,
                    options: syntax.nodes,
                });
            }
        }
        return this.result;
    }
    isExhausted() {
        const index = this.progress.index;
        const isInBounds = index < this.syntax.nodes.length;
        if (!isInBounds) {
            // out of bound error
            return true;
        }
        const isInLast = index === this.syntax.nodes.length - 1;
        if (isInLast) {
            const lastMatcher = this.matchers[index];
            return lastMatcher.isExhausted();
        }
        return false;
    }
}

class AnyOfMatcher extends MultiMatcher<
    DoubleBarNode,
    {
        iterator: CombinationGenerator<BaseMatcher>;
        current: BaseMatcher | null;
        done: boolean;
    }
> {
    init() {
        super.init();
        this.progress.iterator = combinationIterator(this.matchers);
        this.progress.current = null;
        this.progress.done = false;
    }
    forward() {
        const { current, iterator } = this.progress;
        if (current?.isExhausted() === false) {
            current.forward();
        } else {
            //
            const { value, done } = iterator.next();
            this.progress.current = value.last;
            this.progress.done = done === true;
            if (value.takeBack.length) {
                // reset matches
                const matches = this.result.matches;
                matches.length -= value.takeBack.length;
                // reset value position
                this.valueRange[1] = matches.length
                    ? matches[matches.length - 1].value[0].start
                    : this.valueRange[0];
                // reset matchers
                for (const matcher of value.takeBack) {
                    matcher.init(); // maybe there should be reset?
                }
            }
        }
    }
    test(options: MatchOptions) {
        super.test(options);
        const progress = this.progress;

        // const subIndex = progress.index;
        const subMatcher = progress.current!; //this.matchers[subIndex];
        subMatcher.setValueStartIndex(this.valueRange[1]);
        subMatcher.test(options);
        const subMatch = subMatcher.result;
        //   match.errors.length = 0;
        if (subMatch.isValid) {
            this.valueRange[1] = subMatcher.valueRange[1];
            this.result.isValid = true;
            this.result.matches.push(
                ...subMatch.matches.map(({ value, syntax }) => ({ value, syntax }))
            );
        } else {
            // stop any nested iterations
            progress.iterator.next(false);
        }
        // ToDo: maybe move to forward()
        // if (subIndex >= this.matchers.length - 1) {
        //   // state.isDone = true;
        //   if (!this.result.isValid) {
        //     // should filter valid sub syntax(s)
        //     this.result.errors.push({
        //       type: `mismatch`,
        //       syntax: syntax,
        //       options: syntax.nodes,
        //     });
        //   }
        // }
        return this.result;
    }
    isExhausted() {
        return this.progress.done;
    }
}

const matcherMap: Record<ValueSyntaxAstNode['type'], typeof BaseMatcher> = {
    'data-type': DataTypeMatcher as any,
    keyword: KeywordMatcher as any,
    juxtaposing: JuxtaposedMatcher as any,
    '|': OneOfMatcher as any,
    '||': AnyOfMatcher as any,
} as any; // ToDo: finish matchers and fix types
function createMatcher(value: BaseAstNode[], syntax: ValueSyntaxAstNode) {
    if (!matcherMap[syntax.type]) {
        // ToDo: report error
    }
    return new matcherMap[syntax.type](value, syntax);
}
function defaultMatchResult() {
    return {
        isValid: false,
        errors: [],
        matches: [],
    } as MatchResult;
}
function isAcceptedAsType(valueType: BaseAstNode[`type`], syntaxType: string) {
    if (valueType === `<${syntaxType}>`) {
        return true;
    } else if (
        (syntaxType === `number` && valueType === `<integer>`) ||
        (syntaxType === `custom-ident` && valueType === `<dashed-ident>`)
    ) {
        // base inclusion
        return true;
    }
    return false;
}
