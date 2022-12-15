import jStat from 'jstat';
import { IFieldEntry, IOntologyTree, IOntologyRoute } from '@itmat-broker/itmat-types';

export function get_t_test(t_array1: number[], t_array2: number[], digits: number) {
    if (t_array1.length <= 1 || t_array2.length <= 1) {
        return [0, 0];
    }
    const meanA = jStat.mean(t_array1);
    const meanB = jStat.mean(t_array2);
    const S2 = (jStat.sum(jStat.pow(jStat.subtract(t_array1, meanA), 2)) + jStat.sum(jStat.pow(jStat.subtract(t_array2, meanB), 2))) / (t_array1.length + t_array2.length - 2);
    const t_score = (meanA - meanB) / Math.sqrt(S2 / t_array1.length + S2 / t_array2.length);
    const t_pval = jStat.studentt.cdf(-Math.abs(t_score), t_array1.length + t_array2.length - 2) * 2;
    return [parseFloat(t_score.toFixed(digits)), parseFloat(t_pval.toFixed(digits))];
}

export function get_z_test(t_array1: number[], t_array2: number[], digits: number) {
    if (t_array1.length <= 1 || t_array2.length <= 1) {
        return [0, 0];
    }
    const meanA = jStat.mean(t_array1);
    const meanB = jStat.mean(t_array2);
    const varA = jStat.variance(t_array1, true);
    const varB = jStat.variance(t_array2, true);
    const z_score = (meanA - meanB) / (Math.sqrt(varA / t_array1.length + varB / t_array2.length));
    const z_pval = jStat.ztest(z_score, 2);
    return [parseFloat(z_score.toFixed(digits)), parseFloat(z_pval.toFixed(digits))];
}

export function filterFields(fields: IFieldEntry[], ontologyTree: IOntologyTree) {
    if (fields.length === 0 || ontologyTree.routes === undefined || ontologyTree.routes?.length === undefined) {
        return [];
    }

    const validFields: IFieldEntry[] = [];
    const validRouteFields: string[] = ontologyTree.routes.map(el => el.field[0].replace('$', ''));
    fields.forEach(el => {
        if (validRouteFields.includes(el.fieldId.toString())) {
            validFields.push(el);
        }
    });
    return validFields;
}

const rank = {
    /*
     * Standart ranking
     *
     * The MIT License, Copyright (c) 2014 Ben Magyar
     */
    standard: function (array, key) {
        // sort the array
        array = array.sort(function (a, b) {
            const x = a[key];
            const y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
        // assign a naive ranking
        for (let i = 1; i < array.length + 1; i++) {
            array[i - 1]['rank'] = i;
        }
        return array;
    },
    /*
     * Fractional ranking
     *
     * The MIT License, Copyright (c) 2014 Ben Magyar
     */
    fractional: function (array, key) {
        array = this.standard(array, key);
        // now apply fractional
        let pos = 0;
        while (pos < array.length) {
            let sum = 0;
            let i = 0;
            for (i = 0; array[pos + i + 1] && (array[pos + i][key] === array[pos + i + 1][key]); i++) {
                sum += array[pos + i]['rank'];
            }
            sum += array[pos + i]['rank'];
            const endPos = pos + i + 1;
            for (pos; pos < endPos; pos++) {
                array[pos]['rank'] = sum / (i + 1);
            }
            pos = endPos;
        }
        return array;
    },
    rank: function (x, y) {
        let nx = x.length;
        let ny = y.length;
        const combined: any[] = [];
        while (nx--) {
            combined.push({
                set: 'x',
                val: x[nx]
            });
        }
        while (ny--) {
            combined.push({
                set: 'y',
                val: y[ny]
            });
        }
        const ranked = this.fractional(combined, 'val');
        return ranked;
    }
};

const statistic = function (x, y) {
    const ranked = rank.rank(x, y);
    const nr = ranked.length;
    const nx = x.length;
    const ny = y.length;
    const ranksums = {
        x: 0,
        y: 0
    };
    let i = 0, t = 0, nt = 1;

    while (i < nr) {
        if (i > 0) {
            if (ranked[i].val === ranked[i - 1].val) {
                nt++;
            } else {
                if (nt > 1) {
                    t += Math.pow(nt, 3) - nt;
                    nt = 1;
                }
            }
        }
        ranksums[ranked[i].set] += ranked[i].rank;
        i++;
    }
    const tcf = 1 - (t / (Math.pow(nr, 3) - nr));
    const ux = nx * ny + (nx * (nx + 1) / 2) - ranksums.x;
    const uy = nx * ny - ux;

    return {
        tcf: tcf,
        ux: ux,
        uy: uy,
        big: Math.max(ux, uy),
        small: Math.min(ux, uy)
    };
};

const erf = function erf(x) {
    const cof = [-1.3026537197817094, 0.6419697923564, 1.9476473204185836e-2, -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
        4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
        1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
        6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10, 9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13, -1.12708e-13, 3.81e-16, 7.106e-15, -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17
    ];
    let j = cof.length - 1;
    let isneg = false;
    let d = 0;
    let dd = 0;
    let tmp;

    if (x < 0) {
        x = -x;
        isneg = true;
    }

    const t = 2 / (2 + x);
    const ty = 4 * t - 2;

    for (; j > 0; j--) {
        tmp = d;
        d = ty * d - dd + cof[j];
        dd = tmp;
    }

    const res = t * Math.exp(-x * x + 0.5 * (cof[0] + ty * d) - dd);
    return isneg ? res - 1 : 1 - res;
};

const dnorm = function (x, mean, std) {
    return 0.5 * (1 + erf((x - mean) / Math.sqrt(2 * std * std)));
};

export function mannwhitneyu(x, y, alt, corr) {
    // set default value for alternative
    alt = typeof alt !== 'undefined' ? alt : 'two-sided';
    // set default value for continuity
    corr = typeof corr !== 'undefined' ? corr : true;
    const nx = x.length; // x's size
    const ny = y.length; // y's size
    let f = 1;
    let mu, z;

    // test statistic
    const u = statistic(x, y);

    // mean compute and correct if given
    if (corr) {
        mu = (nx * ny / 2) + 0.5;
    } else {
        mu = nx * ny / 2;
    }

    // compute standard deviation using tie correction factor
    const std = Math.sqrt(u.tcf * nx * ny * (nx + ny + 1) / 12);

    // compute z according to given alternative
    if (alt === 'less') {
        z = (u.ux - mu) / std;
    } else if (alt === 'greater') {
        z = (u.uy - mu) / std;
    } else if (alt === 'two-sided') {
        z = Math.abs((u.big - mu) / std);
    } else {
        console.log('Unknown alternative argument');
    }

    // factor to correct two sided p-value
    if (alt === 'two-sided') {
        f = 2;
    }

    // compute p-value using CDF of standard normal
    const p = dnorm(-z, 0, 1) * f;

    return { U: u.small, p: p };
}

export function generateCascader(root: any, array: any, includeEnd: boolean) {
    if (!root) {
        return;
    }
    let arrPointer: any = array;
    const path = [...root.path];
    if (includeEnd) {
        path.push(root.name);
    }
    for (const node of path) {
        const obj = arrPointer.filter((el: { value: any; }) => el.value === node)[0];
        if (!obj) {
            arrPointer.push({
                value: node,
                label: node,
                children: []
            });
        }
        arrPointer = arrPointer.filter((el: { value: any; }) => el.value === node)[0].children;
    }
}

export function findDmField(ontologyTree: IOntologyTree, fields: IFieldEntry[], key: string) {
    const node: IOntologyRoute | undefined = ontologyTree?.routes?.filter(el => el.name === key)[0];
    if (!node) {
        return null;
    }
    const field: IFieldEntry = fields.filter(el => JSON.stringify(['$' + el.fieldId]) === JSON.stringify(node.field))[0];
    if (!field) {
        return null;
    }
    return {
        ...field,
        visitRange: node.visitRange
    };
}
