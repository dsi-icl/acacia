import { IAST, IValueVerifier, enumDataTransformationOperation } from '@itmat-broker/itmat-types';
import { TRPCUtilsCore } from './utilsCore';

type IDataTransformationClip = Record<string, unknown>;

type IDataTransformationClipArray = IDataTransformationClip[];

type IDataTransformationType = IDataTransformationClipArray | IDataTransformationClipArray[];

abstract class DataTransformation {
    abstract transform(data: IDataTransformationType): IDataTransformationType;
}

/**
 * Group data by keys.
 *
 * @input A[]
 * @OUTPUT A[][]
 *
 * @param keys - The keys to group by.
 * @param skipUnmatch - Whether to skip the ungrouped data.
 */
class tGrouping extends DataTransformation {
    protected keys: string[];
    protected skipUnmatch: boolean;
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { keys: string[], skipUnmatch: boolean }, utilsCore: TRPCUtilsCore) {
        super();
        this.keys = params.keys;
        this.skipUnmatch = params.skipUnmatch;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationType {
        // Check input type
        if (!Array.isArray(data) || (data.length > 0 && Array.isArray(data[0]))) {
            throw new Error('Input data must be of type IDataTransformationClipArray (A[]) and not A[][]');
        }

        // Type assertion: after this check, `data` is `IDataTransformationClipArray`
        const clipsArray = data as IDataTransformationClipArray;

        // We'll use a map to group the records. The key will be a string representation of the values of the keys.
        const groupsMap: Record<string, IDataTransformationClipArray> = {};
        const unmatched: IDataTransformationClipArray[] = []; // This will hold arrays
        for (const item of clipsArray) {
            // Check if all specified keys exist in the data item
            const allKeysExist = this.keys.every(key => this.getValueFromNestedKey(item, key) !== undefined);

            if (!allKeysExist) {
                if (this.skipUnmatch) {
                    continue; // skip this item
                } else {
                    unmatched.push([item]); // wrap the unmatched item in an array
                    continue;
                }
            }

            // For each record, we'll generate a key by concatenating the values of the specified keys
            const groupKey = this.keys.map(key => String(this.getValueFromNestedKey(item, key))).join('|');
            // If this group doesn't exist yet, we'll create it
            if (!groupsMap[groupKey]) {
                groupsMap[groupKey] = [];
            }

            // We'll add the current item to its group
            groupsMap[groupKey].push(item);
        }
        // Now, combine matched groups and unmatched items
        const result = [...Object.values(groupsMap), ...unmatched];
        // Otherwise, return the array of groups
        return result as IDataTransformationClipArray[];
    }

    getValueFromNestedKey(obj: Record<string, unknown>, key: string): unknown {
        const keys = key.split('.');
        return this.findValue(obj, keys);
    }

    findValue(obj: Record<string, unknown> | unknown, keys: string[]): unknown {
        if (keys.length === 0 || obj === undefined || obj === null) {
            return obj;
        }

        const [firstKey, ...remainingKeys] = keys;

        if (typeof obj === 'object' && obj !== null && firstKey in obj) {
            return this.findValue((obj as Record<string, unknown>)[firstKey], remainingKeys);
        } else {
            return undefined;
        }
    }
}

/**
 * Convert or delete each value of the data. Note, by default, the execution order is: adding keys -> affine -> remove keys
 *
 * @input A[]
 * @output A[]
 *
 * @param removedKeys - Keys to remove.
 * @param addedKeyRules - Keys to add.
 * @param rules - Rules to convert the values.
 */
class tAffine extends DataTransformation {
    protected removedKeys?: string[];
    protected addedKeyRules?: Array<{ key: IAST, value: IAST }>;
    protected rules?: Record<string, IAST>;
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { removedKeys: string[], rules: Record<string, IAST>, addedKeyRules: Array<{ key: IAST, value: IAST }> }, utilsCore: TRPCUtilsCore) {
        super();
        this.removedKeys = params.removedKeys;
        this.addedKeyRules = params.addedKeyRules;
        this.rules = params.rules;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationClipArray {
        if (!Array.isArray(data) || (data.length > 0 && Array.isArray(data[0]))) {
            throw new Error('Input data must be of type IDataTransformationClipArray (A[]) and not A[][]');
        }

        const affinedData: IDataTransformationClipArray = [];
        for (const item of data as IDataTransformationClipArray) {
            // Add keys
            if (this.addedKeyRules) {
                for (const pair of this.addedKeyRules) {
                    const newKey = this.utilsCore.IASTHelper(pair.key, item) as string;
                    const newValue = this.utilsCore.IASTHelper(pair.value, item);
                    item[newKey] = newValue;
                }
            }

            // Apply rules for affine transformations
            if (this.rules) {
                for (const key of Object.keys(item)) {
                    if (this.rules[key]) {
                        item[key] = this.utilsCore.IASTHelper(this.rules[key], item[key] as number | string | Record<string, unknown>);
                    }
                }
            }

            // Remove specified keys
            if (this.removedKeys) {
                for (const key of this.removedKeys) {
                    delete item[key];
                }
            }

            // Add transformed item to the result if it has keys left
            if (Object.keys(item).length > 0) {
                affinedData.push(item);
            }
        }

        return affinedData;
    }
}

/**
 * Leave one data from a group.
 *
 * @input A[][]
 * @output A[]
 *
 * @param scoreFormula - The formula to give rank of the data.
 * @param isDescend - Whether to rank in descend order.
 */
class tLeaveOne extends DataTransformation {
    protected scoreFormula: IAST;
    protected isDescend: boolean;
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { scoreFormula: IAST, isDescend: boolean }, utilsCore: TRPCUtilsCore) {
        super();
        this.scoreFormula = params.scoreFormula;
        this.isDescend = params.isDescend;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationType {
        if (!Array.isArray(data) || (data.length > 0 && !Array.isArray(data[0]))) {
            throw new Error('Input data must be of type A[][] (array of arrays) and not A[]');
        }

        const mergedData: IDataTransformationClipArray = [];

        for (const items of data as IDataTransformationClipArray[]) {
            const scores: number[] = [];
            for (const item of items) {
                scores.push(this.utilsCore.IASTHelper(this.scoreFormula, item));
            }

            const index = this.isDescend ? scores.indexOf(Math.max(...scores)) : scores.indexOf(Math.min(...scores));
            mergedData.push(items[index]);
        }
        return mergedData;
    }
}

class tJoin extends DataTransformation {
    protected reservedKeys: string[];
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { reservedKeys: string[] }, utilsCore: TRPCUtilsCore) {
        super();
        this.reservedKeys = params.reservedKeys;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationClipArray {
        if (!Array.isArray(data) || (data.length > 0 && !Array.isArray(data[0]))) {
            throw new Error('Input data must be of type A[][] (array of arrays) and not A[]');
        }

        const joinedData: IDataTransformationClipArray = [];
        for (const items of data as IDataTransformationClipArray[]) {
            let obj: IDataTransformationClip = {};
            for (const item of items) {
                obj = {
                    ...obj,
                    ...item
                };
            }
            joinedData.push(obj);
        }
        return joinedData;
    }
}

class tConcat extends DataTransformation {
    protected concatKeys: string[];
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { concatKeys: string[] }, utilsCore: TRPCUtilsCore) {
        super();
        this.concatKeys = params.concatKeys;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationClipArray {
        if (!Array.isArray(data) || (data.length > 0 && !Array.isArray(data[0]))) {
            throw new Error('Input data must be of type A[][] (array of arrays) and not A[]');
        }

        const results: IDataTransformationClipArray = [];
        data.forEach(array => {
            const result: IDataTransformationClip = {};

            array.forEach((item: IDataTransformationClip) => {
                Object.keys(item).forEach(key => {
                    if (this.concatKeys.includes(key)) {
                        if (!result[key]) {
                            result[key] = [];
                        }
                        (result[key] as unknown[]).push(item[key]);
                    } else {
                        if (!result[key]) {
                            result[key] = item[key];
                        }
                    }
                });
            });

            results.push(result);
        });

        return results;
    }
}

/**
 * Deconcat values into an array.
 *
 * @input A[]
 * @output A[][]
 */
class tDeconcat extends DataTransformation {
    protected deconcatKeys: string[];
    protected matchMode: 'combinations' | 'sequential';
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { deconcatKeys: string[], matchMode?: 'combinations' | 'sequential' }, utilsCore: TRPCUtilsCore) {
        super();
        this.deconcatKeys = params.deconcatKeys;
        this.matchMode = params.matchMode || 'combinations';
        this.utilsCore = utilsCore;
    }

    private cartesianProduct(arr: unknown[][]): unknown[][] {
        return arr.reduce((a: unknown[][], b: unknown[]): unknown[][] => {
            return a.flatMap((x: unknown[]): unknown[][] =>
                b.map((y: unknown): unknown[] => x.concat([y]))
            );
        }, [[]]);
    }

    transform(data: IDataTransformationClipArray): IDataTransformationClipArray[] {
        const results: IDataTransformationClipArray[] = [];

        data.forEach((item: IDataTransformationClip) => {
            const subResults: IDataTransformationClip[] = [];

            if (this.matchMode === 'combinations') {
                const arraysToDeconcat: unknown[][] = this.deconcatKeys.map(key => item[key] as unknown[] || []);

                const product = this.cartesianProduct(arraysToDeconcat);

                product.forEach(combination => {
                    const newObj = this.createDeconcatObject(item, combination);
                    subResults.push(newObj);
                });
            } else if (this.matchMode === 'sequential') {
                const maxLength = Math.max(...this.deconcatKeys.map(key => (item[key] as unknown[])?.length || 0));

                for (let i = 0; i < maxLength; i++) {
                    const sequentialValues = this.deconcatKeys.map(key => (item[key] as unknown[])?.[i]);
                    const newObj = this.createDeconcatObject(item, sequentialValues);
                    subResults.push(newObj);
                }
            }

            results.push(subResults);
        });

        return results;
    }

    private createDeconcatObject(item: IDataTransformationClip, values: unknown[]): IDataTransformationClip {
        const newObj: IDataTransformationClip = {};

        this.deconcatKeys.forEach((key, index) => {
            newObj[key] = values[index];
        });

        Object.keys(item).forEach((key: string) => {
            if (!this.deconcatKeys.includes(key)) {
                newObj[key] = item[key];
            }
        });

        return newObj;
    }
}
/**
 * Filter the data.
 *
 * @input A[] | A[][]
 * @output A[] | A[][]
 */
class tFilter extends DataTransformation {
    protected filters: Record<string, IValueVerifier[]>;
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { filters: Record<string, IValueVerifier[]> }, utilsCore: TRPCUtilsCore) {
        super();
        this.filters = params.filters;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationType {
        if (Array.isArray(data) && data.length && Array.isArray(data[0])) {
            return (data as IDataTransformationClipArray[]).map(subArray =>
                subArray.filter(item => this.isValidItem(item))
            );
        } else {
            return (data as IDataTransformationClipArray).filter(item => this.isValidItem(item));
        }
    }

    private isValidItem(data: IDataTransformationClip): boolean {
        const x = Object.keys(this.filters).some(key => {
            return this.filters[key].every(el => {
                return (this.utilsCore.validValueWithVerifier(data as number | string | IDataTransformationClip, el));
            });
        });
        return x;
    }
}

/**
 * Count the data. This should be used after grouping.
 *
 * @input A[][]
 * @output { count: ..., ...}[]
 */
class tCount extends DataTransformation {
    protected addedKeyRules?: Array<{ key: IAST, value: IAST }>;
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { addedKeyRules: Array<{ key: IAST, value: IAST }> }, utilsCore: TRPCUtilsCore) {
        super();
        this.addedKeyRules = params.addedKeyRules;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationClipArray {
        if (!Array.isArray(data) || (data.length > 0 && !Array.isArray(data[0]))) {
            throw new Error('Input data must be of type A[][] (array of arrays) and not A[]');
        }
        const mergerArrays: IDataTransformationClipArray = [];
        for (const group of data as IDataTransformationClipArray[]) {
            const item: IDataTransformationClip = { count: group.length };
            if (this.addedKeyRules) {
                for (const pair of this.addedKeyRules) {
                    item[this.utilsCore.IASTHelper(pair.key, group[0]) as string] = this.utilsCore.IASTHelper(pair.value, group[0]);
                }
            }
            mergerArrays.push(item);
        }
        return mergerArrays;
    }
}

/**
 * Split a data into multiple data.
 *
 * @input A[]
 * @output A[][]
 *
 * @param sharedKeys - The kyes to kept in the new data.
 * @param targetKeyGroups - The keys to add with the shared keys.
 */
class tDegroup extends DataTransformation {
    protected sharedKeys: string[];
    protected targetKeyGroups: string[][];
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { sharedKeys: string[], targetKeyGroups: string[][] }, utilsCore: TRPCUtilsCore) {
        super();
        this.sharedKeys = params.sharedKeys;
        this.targetKeyGroups = params.targetKeyGroups;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationClipArray[] {
        if (!Array.isArray(data) || (data.length > 0 && Array.isArray(data[0]))) {
            throw new Error('Input data must be of type IDataTransformationClipArray (A[]) and not A[][]');
        }

        const splitData: IDataTransformationClipArray[] = [];
        for (const item of data as IDataTransformationClipArray) {
            const saved: IDataTransformationClipArray = [];
            for (let i = 0; i < this.targetKeyGroups.length; i++) {
                const obj: IDataTransformationClip = {};
                for (const key of this.sharedKeys) {
                    obj[key] = item[key];
                }
                for (const key of this.targetKeyGroups[i]) {
                    obj[key] = item[key];
                }
                saved.push(obj);
            }
            splitData.push(saved);
        }
        return splitData;
    }
}
/**
 * Flatten an object. Keys within the object will be keys in the data clip.
 *
 * @input A[] | A[][]
 * @output A[] | A[][]
 *
 * @param keepFlattened - Whether to keep the values from the object if conflicts.
 * @param flattenedKey - The key to flatten.
 * @param keepFlattenedKey - Whether to keep the flattened key.
 */
class tFlatten extends DataTransformation {
    protected keepFlattened: boolean;
    protected flattenedKey: string;
    protected keepFlattenedKey: boolean;
    protected utilsCore: TRPCUtilsCore;

    constructor(params: { keepFlattened: boolean, flattenedKey: string, keepFlattenedKey: boolean }, utilsCore: TRPCUtilsCore) {
        super();
        this.keepFlattened = params.keepFlattened;
        this.flattenedKey = params.flattenedKey;
        this.keepFlattenedKey = params.keepFlattenedKey;
        this.utilsCore = utilsCore;
    }

    transform(data: IDataTransformationType): IDataTransformationType {
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
            return (data as IDataTransformationClipArray[]).map(group => group.map(item => this.flattenItem(item)));
        } else if (Array.isArray(data)) {
            return (data as IDataTransformationClipArray).map(item => this.flattenItem(item));
        } else {
            throw new Error('Invalid input format for tFlatten transform.');
        }
    }

    private flattenItem(item: IDataTransformationClip): IDataTransformationClip {
        const objectToFlatten = item[this.flattenedKey];
        if (typeof objectToFlatten !== 'object' || objectToFlatten === null) {
            return item;
        }

        const flattenedItem: IDataTransformationClip = { ...item };
        for (const key in objectToFlatten) {
            if (!this.keepFlattened || !(key in item)) {
                flattenedItem[key] = objectToFlatten[key];
            }
        }

        if (!this.keepFlattenedKey) {
            delete flattenedItem[this.flattenedKey];
        }

        return flattenedItem;
    }
}




export class TRPCDataTransformationCore {
    protected utilsCore: TRPCUtilsCore;
    constructor(utilsCore: TRPCUtilsCore) {
        this.utilsCore = utilsCore;
    }

    public transformationRegistry = {
        GROUP: tGrouping,
        AFFINE: tAffine,
        LEAVEONE: tLeaveOne,
        CONCAT: tConcat,
        DECONCAT: tDeconcat,
        JOIN: tJoin,
        DEGROUP: tDegroup,
        FILTER: tFilter,
        FLATTEN: tFlatten,
        COUNT: tCount
    };

    public transformationCompose(data: IDataTransformationClipArray, transformations: Array<{ operationName: string, params: unknown }>): IDataTransformationType {
        return transformations.reduce((currentData, transformation) => {
            const TransformationClass = this.transformationRegistry[transformation.operationName];

            if (!TransformationClass) {
                throw new Error(`Transformation ${transformation.operationName} is not registered.`);
            }

            const instance = new TransformationClass(transformation.params, this.utilsCore);
            return instance.transform(currentData);
        }, data);
    }

    public transformationAggregate(
        data: IDataTransformationClipArray,
        transformationsAgg: Record<string, Array<{ operationName: enumDataTransformationOperation, params: unknown }>>
    ): Record<string, IDataTransformationClipArray | IDataTransformationClipArray[]> {
        if (!transformationsAgg || Object.keys(transformationsAgg).length === 0) {
            return { raw: data };
        }

        const aggregation: Record<string, IDataTransformationClipArray | IDataTransformationClipArray[]> = {};
        for (const key of Object.keys(transformationsAgg)) {
            const transformedData = this.transformationCompose(data, transformationsAgg[key]);

            // Ensure the final result is always a flat array
            // aggregation[key] = this.flattenArray(transformedData);
            aggregation[key] = transformedData;
        }
        return aggregation;
    }

    private flattenArray(data: IDataTransformationType): IDataTransformationClipArray {
        if (Array.isArray(data) && Array.isArray(data[0])) {
            return (data as IDataTransformationClipArray[]).flat();
        }
        return data as IDataTransformationClipArray;
    }
}

/**
 * Examples of data transformation
 1. Generate a simplified version of data:
  {
  "aggregation": {
    "device": [
      {
        "params": {
          "keys": [
            "properties.Device Type",
            "properties.Participant ID",
            "properties.Device ID",
            "properties.End Date",
            "properties.Start Date"
          ],
          "skipUnmatch": true
        },
        "operationName": "Group"
      },
      {
        "params": {
          "scoreFormula": {
            "operator": null,
            "type": "VARIABLE",
            "value": "life.createdTime",
            "children": null,
            "parameters": {}
          },
          "isDescend": true
        },
        "operationName": "LeaveOne"
      },
      {
        "operationName": "Filter",
        "params": {
          "filters": {
            "deleted": {
              "formula": {
                "value": "life.deletedTime",
                "operation": null,
                "type": "VARIABLE",
                "parameter": {},
                "children": null
              },
              "value": "",
              "condition": "general:=null",
              "parameters": {}
            }
          }
        }
      },
      {
        "operationName": "Affine",
        "params": {
          "removedKeys": [
            "_id",
            "id",
            "studyId",
            "dataVersion",
            "life",
            "metadata"
          ],
          "addedKeyRules": [],
          "rules": {}
        }
      }
    ],
    "clinical": [
      {
        "operationName": "Group",
        "params": {
          "keys": [
            "properties.Visit ID",
            "properties.Participant ID",
            "fieldId"
          ],
          "skipUnmatch": true
        }
      },
      {
        "operationName": "LeaveOne",
        "params": {
          "scoreFormula": {
            "operator": null,
            "children": null,
            "type": "VARIABLE",
            "value": "life.createdTime",
            "parameters": {}
          },
          "isDescend": true
        }
      },
      {
        "params": {
          "filters": {
            "deleted": {
              "parameters": {},
              "value": "",
              "condition": "general:=null",
              "formula": {
                "parameter": {},
                "value": "life.deletedTime",
                "operation": null,
                "children": null,
                "type": "VARIABLE"
              }
            }
          }
        },
        "operationName": "Filter"
      },
      {
        "operationName": "Affine",
        "params": {
          "removedKeys": [
            "_id",
            "id",
            "studyId",
            "dataVersion",
            "life",
            "metadata"
          ],
          "addedKeyRules": [],
          "rules": {}
        }
      },
      {
        "operationName": "Flatten",
        "params": {
          "keepFlattened": true,
          "flattenedKey": "properties",
          "keepFlattenedKey": false
        }
      },
      {
        "operationName": "Affine",
        "params": {
          "removedKeys": [
            "fieldId",
            "value"
          ],
          "addedKeyRules": [
            {
              "key": {
                "type": "VARIABLE",
                "operator": null,
                "value": "fieldId",
                "parameters": {},
                "children": null
              },
              "value": {
                "type": "VARIABLE",
                "operator": null,
                "value": "value",
                "parameters": {},
                "children": null
              }
            }
          ],
          "rules": {}
        }
      },
      {
        "operationName": "Group",
        "params": {
          "keys": [
            "Participant ID",
            "Visit ID"
          ],
          "skipUnMatch": false
        }
      },
      {
        "operationName": "Join",
        "params": {
          "reservedKeys": [
            "Participant ID",
            "Visit ID"
          ]
        }
      }
    ]
  },
  "useCache": false,
  "studyId": "96f17282-e0a3-43d3-8f38-326949b786ef",
  "versionId": null,
  "forceUpdate": false
}

 2. Generate data standardization pipeline:

 */