export function flattenObjectToArray(entry: any) {
    const arr: string[] = [];
    const nestedArray = flattenObjectToArrayHelper(entry);
    const helper = (el: any) => {
        if (typeof el === 'string') {
            arr.push(el);
        } else {
            el.forEach(helper);
        }
    };
    nestedArray.forEach(helper);
    return arr;
}
function flattenObjectToArrayHelper(entry: any): any {
    if (typeof entry === 'string') {
        return entry;
    } else {
        const values = Object.values(entry);
        return values.map(flattenObjectToArrayHelper);
    }
}
