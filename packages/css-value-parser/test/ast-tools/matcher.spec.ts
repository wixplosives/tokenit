import { parseCSSValue, parseValueSyntax, match } from '@tokey/css-value-parser';
import type { Combinators } from '@tokey/css-value-parser/dist/value-syntax-parser';
import { expect } from 'chai';

describe(`ast-tools/matcher`, () => {
    describe(`data-type`, () => {
        it(`should match type`, () => {
            const value = parseCSSValue(`5`);
            const syntax = parseValueSyntax(`<integer>`);

            const { isValid, errors, matches } = match(value, syntax);

            expect(isValid, `valid`).to.equal(true);
            expect(errors, `errors`).to.eql([]);
            expect(matches, `matches`).to.eql([
                {
                    syntax: syntax, // <integer>
                    value: [value[0]], // 5
                },
            ]);
        });
        it(`should deny mismatched type`, () => {
            const value = parseCSSValue(`5`);
            const syntax = parseValueSyntax(`<length>`);

            const { isValid, errors, matches } = match(value, syntax);

            expect(isValid, `invalid`).to.equal(false);
            expect(errors, `errors`).to.eql([{ type: `mismatch`, syntax }]);
            expect(matches, `matches`).to.eql([]);
        });
        describe(`valid as`, () => {
            [
                // base
                {
                    type: `<integer> as <number>`,
                    value: `5`,
                    syntax: `<number>`,
                },
                {
                    type: `<dashed-ident> as <custom-ident>`,
                    value: `--a`,
                    syntax: `<custom-ident>`,
                },
            ].forEach(({ type, value, syntax }) => {
                it(`should match ${type}`, () => {
                    const valueAst = parseCSSValue(value);
                    const syntaxAst = parseValueSyntax(syntax);
                    const { isValid, errors, matches } = match(valueAst, syntaxAst);

                    expect(isValid, `valid`).to.equal(true);
                    expect(errors, `errors`).to.eql([]);
                    expect(matches, `matches`).to.eql([
                        {
                            syntax: syntaxAst,
                            value: [valueAst[0]],
                        },
                    ]);
                });
            });
        });
    });
    describe(`keyword`, () => {
        it(`should match keyword`, () => {
            const value = parseCSSValue(`disc`);
            const syntax = parseValueSyntax(`disc`);

            const { isValid, errors, matches } = match(value, syntax);

            expect(isValid, `valid`).to.equal(true);
            expect(errors, `errors`).to.eql([]);
            expect(matches, `matches`).to.eql([
                {
                    syntax: syntax, // disc
                    value: [value[0]], // disc
                },
            ]);
        });
        it(`should match case-insensitively`, () => {
            const value = parseCSSValue(`DiSc`);
            const syntax = parseValueSyntax(`disc`);

            const { isValid, errors, matches } = match(value, syntax);

            expect(isValid, `valid`).to.equal(true);
            expect(errors, `errors`).to.eql([]);
            expect(matches, `matches`).to.eql([
                {
                    syntax: syntax, // disc
                    value: [value[0]], // DiSc
                },
            ]);
        });
        it(`should deny mismatched keyword`, () => {
            const value = parseCSSValue(`abc`);
            const syntax = parseValueSyntax(`xyz`);

            const { isValid, errors, matches } = match(value, syntax);

            expect(isValid, `invalid`).to.equal(false);
            expect(errors, `errors`).to.eql([{ type: `mismatch`, syntax }]);
            expect(matches, `matches`).to.eql([]);
        });
        it(`should deny quoted keyword (string)`, () => {
            const value = parseCSSValue(`"abc"`);
            const syntax = parseValueSyntax(`abc`);

            const { isValid, errors, matches } = match(value, syntax);

            expect(isValid, `invalid`).to.equal(false);
            expect(errors, `errors`).to.eql([{ type: `mismatch`, syntax }]);
            expect(matches, `matches`).to.eql([]);
        });
    });
    describe(`multipliers`, () => {
        describe(`one or more (+)`, () => {
            it(`should match one`, () => {
                const value = parseCSSValue(`5`);
                const syntax = parseValueSyntax(`<integer>+`);

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax, // <integer>+
                        value: [value[0]], // 5
                    },
                ]);
            });
            it.skip(`should match many`, () => {
                const value = parseCSSValue(`5 6`);
                const syntax = parseValueSyntax(`<integer>+`);

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax, // <integer>+
                        value: [value[0], value[2]], // 5 6
                    },
                ]);
            });
            it.skip(`should match type after many`, () => {
                const value = parseCSSValue(`5 6 7s`);
                const syntax = parseValueSyntax(`<integer>+ <time>`);

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax, // <integer>+
                        value: [value[0], value[2]], // 5 6
                    },
                    {
                        syntax: syntax, // <time>
                        value: [value[4]], // 7s
                    },
                ]);
            });
        });
    });
    describe(`combinators`, () => {
        describe(`juxtaposing`, () => {
            it(`should accept match type`, () => {
                const value = parseCSSValue(`5 6px`);
                const syntax = parseValueSyntax(`<integer> <length>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[0], // <integer>
                        value: [value[0]], // 5
                    },
                    {
                        syntax: syntax.nodes[1], // <length>
                        value: [value[2]], // 6px
                    },
                ]);
            });
            it(`should deny mismatched type`, () => {
                const value = parseCSSValue(`6px 5`);
                const syntax = parseValueSyntax(`<integer> <length>`);

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `invalid`).to.equal(false);
                expect(errors, `errors`).to.eql([{ type: `mismatch`, syntax: syntax }]);
                expect(matches, `matches`).to.eql([]);
            });
            it(`should deny mismatched type (at the end)`, () => {
                const value = parseCSSValue(`6 5ms`);
                const syntax = parseValueSyntax(`<integer> <length>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `invalid`).to.equal(false);
                expect(errors, `errors`).to.eql([{ type: `mismatch`, syntax: syntax }]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[0], // <integer>
                        value: [value[0]], // 6
                    },
                ]);
            });
        });
        describe(`one-of (|)`, () => {
            it(`should accept single matched type`, () => {
                const value = parseCSSValue(`5`);
                const syntax = parseValueSyntax(`<integer> | <length>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[0], // <integer>
                        value: [value[0]], // 5
                    },
                ]);
            });
            it(`should accept another match type`, () => {
                const value = parseCSSValue(`5s`);
                const syntax = parseValueSyntax(`<integer> | <length> | <time>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[2], // <time>
                        value: [value[0]], // 5s
                    },
                ]);
            });
            it(`should accept the option that matched the entire value`, () => {
                const value = parseCSSValue(`1 2px`);
                const syntax = parseValueSyntax(`<number> | <number> <length>`);

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: (syntax as any).nodes[1].nodes[0], // <number>
                        value: [value[0]], // 1
                    },
                    {
                        syntax: (syntax as any).nodes[1].nodes[1], // <length>
                        value: [value[2]], // 2px
                    },
                ]);
            });
            it(`should deny when no type matches`, () => {
                const value = parseCSSValue(`abc`);
                const syntax = parseValueSyntax(`<integer> | <length> | <time>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `invalid`).to.equal(false);
                expect(errors, `errors`).to.eql([
                    {
                        type: `mismatch`,
                        syntax: syntax,
                        options: [syntax.nodes[0], syntax.nodes[1], syntax.nodes[2]],
                    },
                ]);
                expect(matches, `matches`).to.eql([]);
            });
            it(`should deny overflow values`, () => {
                const value = parseCSSValue(`1 2em`);
                const syntax = parseValueSyntax(`<time> | <length> | <integer>`);

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `invalid`).to.equal(false);
                expect(errors, `errors`).to.eql([{ type: `valueOverflow` }]);
                expect(matches, `matches`).to.eql([]);
            });
        });
        describe(`any-of (||)`, () => {
            it(`should accept single match`, () => {
                const value = parseCSSValue(`5`);
                const syntax = parseValueSyntax(`<integer> || <string>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[0], // <integer>
                        value: [value[0]], // 5
                    },
                ]);
            });
            it(`should accept all match`, () => {
                const value = parseCSSValue(`5 6px`);
                const syntax = parseValueSyntax(`<integer> || <length>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[0], // <integer>
                        value: [value[0]], // 5
                    },
                    {
                        syntax: syntax.nodes[1], // <length>
                        value: [value[2]], // 6px
                    },
                ]);
            });
            it(`should accept partial match`, () => {
                const value = parseCSSValue(`1ms 2em`);
                const syntax = parseValueSyntax(`<time> || <length> || <string>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[0], // <time>
                        value: [value[0]], // 1ms
                    },
                    {
                        syntax: syntax.nodes[1], // <length>
                        value: [value[2]], // 2em
                    },
                ]);
            });
            it(`should accept in any order`, () => {
                const value = parseCSSValue(`1ms "2" 3em`);
                const syntax = parseValueSyntax(`<string> || <length> || <time>`) as Combinators;

                const { isValid, errors, matches } = match(value, syntax);

                expect(isValid, `valid`).to.equal(true);
                expect(errors, `errors`).to.eql([]);
                expect(matches, `matches`).to.eql([
                    {
                        syntax: syntax.nodes[2], // <time>
                        value: [value[0]], // 1ms
                    },
                    {
                        syntax: syntax.nodes[0], // <string>
                        value: [value[2]], // "2"
                    },
                    {
                        syntax: syntax.nodes[1], // <length>
                        value: [value[4]], // 3em
                    },
                ]);
            });
            // it(`should deny when no type matches`, () => {
            //   const value = parseCSSValue(`abc`);
            //   const syntax = parseValueSyntax(
            //     `<integer> || <length> || <time>`
            //   ) as Combinators;

            //   const { isValid, errors, matches } = match2(value, syntax);

            //   expect(isValid, `invalid`).to.equal(false);
            //   expect(errors, `errors`).to.eql([
            //     {
            //       type: `mismatch`,
            //       syntax: syntax,
            //       options: [syntax.nodes[0], syntax.nodes[1], syntax.nodes[2]],
            //     },
            //   ]);
            //   expect(matches, `matches`).to.eql([]);
            // });
        });
    });
});
