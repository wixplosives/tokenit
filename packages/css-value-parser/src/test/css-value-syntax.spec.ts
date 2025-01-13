import { parseValueSyntax } from '@tokey/css-value-parser';
import { expect } from 'chai';
//TODO: fixme
import {
    bar,
    booleanExpr,
    dataType,
    doubleAmpersand,
    doubleBar,
    group,
    juxtaposing,
    keyword,
    literal,
    property,
} from '../value-syntax-parser';

import * as webCssRef from '@webref/css';

describe(`sanity`, () => {
    const knownProblemticValuespacesCases = [
        `<custom-selector>: <custom-arg>? : <extension-name> [ ( <custom-arg>+#? ) ]? ;`,
    ];
    before(async () => {
        const specs = await webCssRef.listAll();
        for (const [specName, data] of Object.entries(specs)) {
            describe(specName, () => {
                describe('properties', () => {
                    for (const { name, value } of Object.values(data.properties)) {
                        if (value) {
                            it(`<'${name}'>: ${value}`, () => {
                                parseValueSyntax(value);
                            });
                        }
                    }
                });
                describe('valuespaces', () => {
                    for (const { name, value } of data.values) {
                        if (value) {
                            const title = `${name}: ${value}`;
                            if (knownProblemticValuespacesCases.includes(title)) {
                                continue;
                            }
                            it(title, () => {
                                parseValueSyntax(value);
                            });
                        }
                    }
                });
            });
        }
    });
    it(`just here to make the before dynamically load and create tests`, () => {
        /**/
    });
});

// add test for #

describe('value-syntax-parser', () => {
    describe('components', () => {
        it('should parse simple data-type component', () => {
            expect(parseValueSyntax(`<name>`)).to.eql(dataType('name'));
        });

        it('should parse simple data-type component with range definition', () => {
            expect(parseValueSyntax(`<name [1,1000]>`)).to.eql(dataType('name', [1, 1000]));
            expect(parseValueSyntax(`<name [ 1 , 1000 ] >`)).to.eql(dataType('name', [1, 1000]));
        });

        it('should parse simple property component', () => {
            expect(parseValueSyntax(`<'name'>`)).to.eql(property('name'));
        });

        it('should parse simple property component with range definition', () => {
            expect(parseValueSyntax(`<'name' [1,1000]>`)).to.eql(property('name', [1, 1000]));
            expect(parseValueSyntax(`<'name' [ 1 , 1000 ] >`)).to.eql(property('name', [1, 1000]));
            expect(parseValueSyntax(`<'name' [ -∞ , ∞ ] >`)).to.eql(
                property('name', [-Infinity, Infinity]),
            );
        });
    });

    describe('literals/keyword', () => {
        it('should parse simple keyword value', () => {
            expect(parseValueSyntax(`name`)).to.eql(keyword('name'));
        });
        it('should parse open enclosed literal value (with delimiter)', () => {
            expect(parseValueSyntax(`'<'`)).to.eql(literal('<', true));
        });
        it('should parse open enclosed literal value', () => {
            expect(parseValueSyntax(`'name'`)).to.eql(literal('name', true));
        });
        it('should parse open enclosed literal value (with delimiter in the middle)', () => {
            expect(parseValueSyntax(`'na>me'`)).to.eql(literal('na>me', true));
        });
        it('should parse open parentheses literal value', () => {
            expect(parseValueSyntax(`(`)).to.eql(literal('('));
        });
        it('should parse close parentheses literal value', () => {
            expect(parseValueSyntax(`)`)).to.eql(literal(')'));
        });
        it('should parse comma literal value', () => {
            expect(parseValueSyntax(`,`)).to.eql(literal(','));
        });
        it('should parse slash literal value', () => {
            expect(parseValueSyntax(`/`)).to.eql(literal('/'));
        });
    });

    describe('multipliers', () => {
        it('data-type with multipliers', () => {
            expect(parseValueSyntax(`<name>!`)).to.eql(
                dataType('name', undefined, { range: [1, 1] }),
            );
            expect(parseValueSyntax(`<name>?`)).to.eql(
                dataType('name', undefined, { range: [0, 1] }),
            );
            expect(parseValueSyntax(`<name>+`)).to.eql(
                dataType('name', undefined, { range: [1, Infinity] }),
            );
            expect(parseValueSyntax(`<name>*`)).to.eql(
                dataType('name', undefined, { range: [0, Infinity] }),
            );
            expect(parseValueSyntax(`<name>{2}`)).to.eql(
                dataType('name', undefined, { range: [2, 2] }),
            );
            expect(parseValueSyntax(`<name>{2, 4}`)).to.eql(
                dataType('name', undefined, { range: [2, 4] }),
            );
        });
        it('property with multipliers', () => {
            expect(parseValueSyntax(`<'name'>!`)).to.eql(
                property('name', undefined, { range: [1, 1] }),
            );
            expect(parseValueSyntax(`<'name'>?`)).to.eql(
                property('name', undefined, { range: [0, 1] }),
            );
            expect(parseValueSyntax(`<'name'>+`)).to.eql(
                property('name', undefined, { range: [1, Infinity] }),
            );
            expect(parseValueSyntax(`<'name'>*`)).to.eql(
                property('name', undefined, { range: [0, Infinity] }),
            );
            expect(parseValueSyntax(`<'name'>{2}`)).to.eql(
                property('name', undefined, { range: [2, 2] }),
            );
            expect(parseValueSyntax(`<'name'>{2, 4}`)).to.eql(
                property('name', undefined, { range: [2, 4] }),
            );
        });
        it('literal with multipliers', () => {
            expect(parseValueSyntax(`'name'!`)).to.eql(literal('name', true, { range: [1, 1] }));
            expect(parseValueSyntax(`'name'?`)).to.eql(literal('name', true, { range: [0, 1] }));
            expect(parseValueSyntax(`'name'+`)).to.eql(
                literal('name', true, { range: [1, Infinity] }),
            );
            expect(parseValueSyntax(`'name'*`)).to.eql(
                literal('name', true, { range: [0, Infinity] }),
            );
            expect(parseValueSyntax(`'name'{2}`)).to.eql(literal('name', true, { range: [2, 2] }));
            expect(parseValueSyntax(`'name'{2, 4}`)).to.eql(
                literal('name', true, { range: [2, 4] }),
            );
        });
        it('keyword with multipliers', () => {
            expect(parseValueSyntax(`name!`)).to.eql(keyword('name', { range: [1, 1] }));
            expect(parseValueSyntax(`name?`)).to.eql(keyword('name', { range: [0, 1] }));
            expect(parseValueSyntax(`name+`)).to.eql(keyword('name', { range: [1, Infinity] }));
            expect(parseValueSyntax(`name*`)).to.eql(keyword('name', { range: [0, Infinity] }));
            expect(parseValueSyntax(`name{2}`)).to.eql(keyword('name', { range: [2, 2] }));
            expect(parseValueSyntax(`name{2, 4}`)).to.eql(keyword('name', { range: [2, 4] }));
        });
        it('group with multipliers', () => {
            expect(parseValueSyntax(`[a]!`)).to.eql(group([keyword('a')], { range: [1, 1] }));
            expect(parseValueSyntax(`[a]?`)).to.eql(group([keyword('a')], { range: [0, 1] }));
            expect(parseValueSyntax(`[a]+`)).to.eql(
                group([keyword('a')], { range: [1, Infinity] }),
            );
            expect(parseValueSyntax(`[a]*`)).to.eql(
                group([keyword('a')], { range: [0, Infinity] }),
            );
            expect(parseValueSyntax(`[a]{2}`)).to.eql(group([keyword('a')], { range: [2, 2] }));
            expect(parseValueSyntax(`[a]{2, 4}`)).to.eql(group([keyword('a')], { range: [2, 4] }));
        });
    });

    describe('combinators', () => {
        describe('group', () => {
            it('should parse group combinator', () => {
                expect(parseValueSyntax(`[a]`)).to.eql(group([keyword('a')]));
            });
            it('should parse nested group combinator', () => {
                expect(parseValueSyntax(`[[a]]`)).to.eql(group([group([keyword('a')])]));
            });
        });
        describe('juxtaposition', () => {
            it('should parse juxtaposition combinator (with two nodes)', () => {
                expect(parseValueSyntax(`a b`)).to.eql(juxtaposing([keyword('a'), keyword('b')]));
            });
            it('should parse juxtaposition combinator (with three nodes)', () => {
                expect(parseValueSyntax(`a b c`)).to.eql(
                    juxtaposing([keyword('a'), keyword('b'), keyword('c')]),
                );
            });
        });
        describe('double-ampersand', () => {
            it('should parse double-ampersand combinator', () => {
                expect(parseValueSyntax(`a && b`)).to.eql(
                    doubleAmpersand([keyword('a'), keyword('b')]),
                );
            });
            it('should parse double-ampersand combinator with more then two items', () => {
                expect(parseValueSyntax(`a && b && c`)).to.eql(
                    doubleAmpersand([keyword('a'), keyword('b'), keyword('c')]),
                );
            });
        });
        describe('double-bar', () => {
            it('should parse double-bar combinator', () => {
                expect(parseValueSyntax(`a || b`)).to.eql(doubleBar([keyword('a'), keyword('b')]));
            });
            it('should parse double-bar combinator with more then two items', () => {
                expect(parseValueSyntax(`a || b || c`)).to.eql(
                    doubleBar([keyword('a'), keyword('b'), keyword('c')]),
                );
            });
        });
        describe('bar', () => {
            it('should parse bar combinator', () => {
                expect(parseValueSyntax(`a | b`)).to.eql(bar([keyword('a'), keyword('b')]));
            });
            it('should parse bar combinator', () => {
                expect(parseValueSyntax(`a | b | c`)).to.eql(
                    bar([keyword('a'), keyword('b'), keyword('c')]),
                );
            });
        });
    });

    describe('grouping order', () => {
        it('no grouping ordering', () => {
            expect(parseValueSyntax(`a b | c || d && e f`)).to.eql(
                bar([
                    juxtaposing([keyword('a'), keyword('b')]),
                    doubleBar([
                        keyword('c'),
                        doubleAmpersand([keyword('d'), juxtaposing([keyword('e'), keyword('f')])]),
                    ]),
                ]),
            );
        });
    });

    describe('boolean-expr', () => {
        // https://drafts.csswg.org/css-values-5/#boolean
        it('should parse with inner test nodes', () => {
            const x = parseValueSyntax(`<boolean-expr[<if-test>]>`);
            expect(x).to.eql(booleanExpr([dataType('if-test')]));
        });
        it('should fail for missing nodes', () => {
            expect(() => parseValueSyntax(`<boolean-expr>`)).to.throw('missing boolean expression');
        });
    });
});
