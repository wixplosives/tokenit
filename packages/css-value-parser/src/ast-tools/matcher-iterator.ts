export type CombinationGenerator<T> = Generator<
    CombinationResult<T>,
    CombinationResult<T>,
    boolean | undefined
>;
export type CombinationResult<T> = {
    combination: T[];
    last: T;
    takeBack: T[];
};
export function* combinationIterator<T>(allOptions: T[]): CombinationGenerator<T> {
    const stack: { options: T[]; start: T[]; index: number }[] = [
        { options: [...allOptions], start: [], index: 0 },
    ];
    const prevCombinations: T[] = [];
    while (true) {
        const context = stack[stack.length - 1]!;
        const { options, start, index } = context;
        // add results
        const added = options[index];
        const combination = start.concat(added);
        const result = {
            combination: combination,
            last: added,
            takeBack:
                combination.length >= prevCombinations.length
                    ? []
                    : prevCombinations.slice(prevCombinations.length - combination.length),
        };
        prevCombinations.length = 0;
        prevCombinations.push(...combination);
        // progress position
        if (context.index < options.length - 1) {
            context.index++;
        } else {
            stack.pop();
        }
        // add sub options to context
        if (options.length > 1) {
            stack.push({
                options: [...options.slice(0, index), ...options.slice(index + 1)],
                start: combination,
                index: 0,
            });
        }
        const stopStack = yield result;
        if (stopStack === false) {
            stack.pop();
            yield result;
        }
        if (!stack.length) {
            return result;
        }
    }
}

// const ABC = combinationIterator(["A", "B", "C"]);
// for (const option of ABC) {
//   console.log(option.combination.join(" "));
//   if (option.combination[1] === "B") {
//     ABC.next(false);
//   }
// }

// const iterator = combinationIterator(["A", "B", "C", "D", "E", "F", "G", "H"]);
// let i = 0;
// // eslint-disable-next-line no-constant-condition
// while (true) {
//   const { value, done } = iterator.next();
//   console.log(value.combination.join(" "));
//   if (done) {
//     break;
//   }
//   i++
// }
// console.log(i);
