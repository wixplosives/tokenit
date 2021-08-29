import { defineProperty, parseCssValue } from "@tokey/css-value-parser";
import { expect } from "chai";

describe(`value-parser/define-property`, () => {
  describe(`validation`, () => {
    it(`should approve valid syntax`, () => {
      const p = defineProperty({
        name: `my-prop`,
        syntax: `<number>`,
      });

      expect(p.validate(parseCssValue(`55`))).to.equal([]);
    });
    it(`should warn on unexpected type`, () => {
      const p = defineProperty({
        name: `my-prop`,
        syntax: `<number>`,
      });

      const ast = parseCssValue(`abc`);
      const errors = p.validate(ast);

      expect(errors).to.equal([
        {
          msg: defineProperty.errors.unexpectedType(ast[0], `number`),
          ref: ast[0],
        },
      ]);
    });
    it(`should warn on top level comma`, () => {
      const p = defineProperty({
        name: `my-prop`,
        syntax: `<number>`,
      });

      const ast = parseCssValue(`44,55`);
      const errors = p.validate(ast);

      expect(errors).to.equal([
        {
          msg: defineProperty.errors.unexpectedComma(),
          ref: ast,
        },
      ]);
    });
    it(`should NOT warn on expected top level comma`, () => {
      const p = defineProperty({
        name: `my-prop`,
        syntax: `<number>#`,
        topLevelCommaSeparation: true,
      });

      const ast = parseCssValue(`44,55`);
      const errors = p.validate(ast);

      expect(errors).to.equal([]);
    });
  });
  describe(`format`, () => {
    it(`should match a defined format`, () => {
      const p = defineProperty({
        name: `my-prop`,
        syntax: `<number> | <string> | <boolean>`,
        formats: {
          number: `<number>`,
          string: `<string>`,
          boolean: `<boolean>`,
        },
      });

      expect(p.getFormat(parseCssValue(`55`)), `number`).to.eql(`number`);
      expect(p.getFormat(parseCssValue(`xy`)), `string`).to.eql(`string`);
      expect(p.getFormat(parseCssValue(`true`)), `boolean`).to.eql(`boolean`);
      expect(p.getFormat(parseCssValue(`5px`)), `unknown`).to.eql(undefined);
    });
  });
  describe(`classification`, () => {
    it(`should classify inner parts`, () => {
      const p = defineProperty({
        name: `my-prop`,
        syntax: `<number> <string>`,
        classifications: {
          amount: (node) => node.type === `<number>`,
          name: (node) => node.type === `<string>`,
        },
      });

      const ast = parseCssValue(`50 abc`);
      const classification = p.classify(ast);

      expect(classification.amount.value).to.equal(ast[0]);
      expect(classification.name.value).to.equal(ast[2]);
    });
  });
  describe(`vars`, () => {
    // ToDo: handle unknown var
    describe(`css properties`, () => {
      it(`should resolve origin`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<number>`,
          classifications: {
            amount: (node) => node.type === `<number>`,
          },
        });

        const ast = parseCssValue(`var(--x)`);
        const cssVars = {
          x: parseCssValue(`123`),
        };

        expect(p.classify(ast, { cssVars })).deep.include({
          amount: {
            value: [cssVars.x[0]],
            resolved: [
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[0]] },
              ],
            ],
          },
        });
      });
      it(`should resolve multiple parts from single origin`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<number> <number>`,
          classifications: {
            amountA: (node, { indexOfType }) =>
              node.type === `<number>` && indexOfType === 0,
            amountB: (node, { indexOfType }) =>
              node.type === `<number>` && indexOfType === 1,
          },
        });

        const ast = parseCssValue(`var(--x)`);
        const cssVars = {
          x: parseCssValue(`123 789`),
        };

        expect(p.classify(ast, { cssVars })).deep.include({
          amountA: {
            value: [cssVars.x[0]],
            resolved: [
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[0]] },
              ],
            ],
          },
          amountB: {
            value: [cssVars.x[2]],
            resolved: [
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[2]] },
              ],
            ],
          },
        });
      });
      it(`should resolve multiple parts from multiple origins`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<number> <number>`,
          classifications: {
            amountA: (node, { indexOfType }) =>
              node.type === `<number>` && indexOfType === 0,
            amountB: (node, { indexOfType }) =>
              node.type === `<number>` && indexOfType === 1,
          },
        });

        const ast = parseCssValue(`var(--x) var(--y)`);
        const cssVars = {
          x: parseCssValue(`123`),
          y: parseCssValue(`789`),
        };

        expect(p.classify(ast, { cssVars })).deep.include({
          amountA: {
            value: [cssVars.x[0]],
            resolved: [
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[0]] },
              ],
            ],
          },
          amountB: {
            value: [cssVars.y[0]],
            resolved: [
              [
                { origin: ast, nodes: [ast[2]] },
                { origin: cssVars.y, nodes: [cssVars.y[0]] },
              ],
            ],
          },
        });
      });
      it(`should resolve complex part from single origin`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<length> <length>`,
          classifications: {
            position: {
              syntax: `<length> <length>`,
            },
          },
        });

        const ast = parseCssValue(`var(--x)`);
        const cssVars = {
          x: parseCssValue(`1px 2px`),
        };

        expect(p.classify(ast, { cssVars })).deep.include({
          position: {
            value: [cssVars.x[0], cssVars.x[1], cssVars.x[2]],
            resolved: [
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[0]] },
              ],
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[1]] },
              ],
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[2]] },
              ],
            ],
          },
        });
      });
      it(`should resolve complex part from multiple origins`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<length> <length>`,
          classifications: {
            position: {
              syntax: `<length> <length>`,
            },
          },
        });

        const ast = parseCssValue(`var(--x) var(--y)`);
        const cssVars = {
          x: parseCssValue(`1px`),
          y: parseCssValue(`2px`),
        };

        expect(p.classify(ast, { cssVars })).deep.include({
          position: {
            value: [cssVars.x[0], ast[1], cssVars.y[0]],
            resolved: [
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: cssVars.x, nodes: [cssVars.x[0]] },
              ],
              [{ origin: ast, nodes: [ast[1]] }],
              [
                { origin: ast, nodes: [ast[2]] },
                { origin: cssVars.y, nodes: [cssVars.y[0]] },
              ],
            ],
          },
        });
      });
      it(`should NOT resolve concatenated values`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<length>`,
          classifications: {
            size: (node) => node.type === `<length>`,
          },
        });

        const ast = parseCssValue(`var(--x)px`);
        const cssVars = {
          x: parseCssValue(`5`),
        };

        // ToDo: maybe all methods should always output errors
        expect(p.classify(ast, { cssVars })).deep.include({
          amount: {
            ref: undefined,
            resolved: [],
          },
        });
      });
    });
    describe(`build vars`, () => {
      const $varParser = {} as any;
      it(`should resolve origin`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<number>`,
          classifications: {
            amount: (node) => node.type === `<number>`,
          },
        });

        const ast = parseCssValue(`$x`, { parseBuildVar: $varParser });
        const buildVars: Record<string, ReturnType<typeof parseCssValue>> = {
          $x: parseCssValue(`123`),
        };

        expect(
          p.classify(ast, { resolveBuildVar: ({ id }) => buildVars[id] })
        ).deep.include({
          amount: {
            value: [buildVars.$x[0]],
            resolved: [
              [
                { origin: ast[0], nodes: [ast[0]] },
                { origin: buildVars.$x, nodes: [buildVars.$x[0]] },
              ],
            ],
          },
        });
      });
      it(`should resolve concatenated origin`, () => {
        const p = defineProperty({
          name: `my-prop`,
          syntax: `<length>`,
          classifications: {
            amount: (node) => node.type === `<number>`,
          },
        });

        const ast = parseCssValue(`#($x)px`, { parseBuildVar: $varParser });
        const buildVars: Record<string, ReturnType<typeof parseCssValue>> = {
          $x: parseCssValue(`123`),
        };

        expect(
          p.classify(ast, { resolveBuildVar: ({ id }) => buildVars[id] })
        ).deep.include({
          amount: {
            value: [buildVars.$x[0], ast[1]],
            resolved: [
              [
                { origin: ast, nodes: [ast[0]] },
                { origin: buildVars.$x, nodes: [buildVars.$x[0]] },
              ],
              [{ origin: ast, nodes: [ast[1]] }],
            ],
          },
        });
      });
    });
  });
});
