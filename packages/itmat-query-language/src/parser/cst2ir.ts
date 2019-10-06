export interface INode {
    type: string;
    token?: boolean;
    children?: INode[];
    value?: string;
}

export interface ICondensedConditionNode {
    type: string;
    image: boolean;
    comparisonOperator: string;
    referenceField: IFieldDescription;
    targetValue?: string | number | IFieldDescription;
    expression: string;
    leaf: boolean;
}

export enum WILDCARD {
    ANY = 'ANY',
}

export interface IFieldDescription {
    field: number | string;
    instance: number | WILDCARD;
    array: number | WILDCARD;
}

export class CST2IR {
    private workingTree: any;
    constructor(private readonly cst: any) {
        this.workingTree = cst;
        this.trimTree = this.trimTree.bind(this);
    }

    public toIR() {
        const trimmedTree = this.trimTree(this.workingTree);
        return this.mapAndOr(trimmedTree);
    }

    private mapAndOr(node: INode): any {
        if (node.children && node.children.filter((el) => el.type === 'CONDITION_GROUP_PRIME').length !== 0) {
            const primeNode = node.children.filter((el) => el.type === 'CONDITION_GROUP_PRIME')[0];
            const conjunction = primeNode.children![0].value === 'AND' ? '$and' : '$or';
            const leftConditionIndex = node.children.indexOf(primeNode) - 1;
            const leftCondition: any = this.mapAndOr(node.children[leftConditionIndex]);
            if (primeNode.children!.length === 2) {
                const rightCondition: any = this.mapAndOr(primeNode.children![1]);
                return ({ [conjunction]: [ leftCondition, rightCondition ] });
            } else if (primeNode.children!.length === 3) {
                return ({ [conjunction]: [leftCondition, this.mapAndOr(primeNode)] });
            }

        } else {
            return node;
        }
    }

    private trimTree(node: INode | ICondensedConditionNode): INode | ICondensedConditionNode {
        if ((node as INode).token || (node as ICondensedConditionNode).leaf) { // if node is end token
            return node;
        } else {
            node = this.removeEpsilon(node);
            const children = this.processOneLevel((node as INode).children!);
            return ({ ...node, children: children!.map(this.trimTree) });
        }
    }

    private processOneLevel(children: INode[]): Array<INode|ICondensedConditionNode> {
        return children.map((el) => {
            el = this.convertConditionNodes(el);
            return el;
        });
    }

    private convertConditionNodes(node: INode): INode|ICondensedConditionNode {
        if (node.type === 'CONDITION' && node.children![0].type !== 'PARENTHESIS') {
            const properties = node.children!.reduce((acc, el) => { acc[el.type] = el.value || el.children; return acc; }, {} as any);
            const newNode: ICondensedConditionNode = {
                type: 'CONDITION',
                image: false,
                comparisonOperator: properties.COMPARISON_OPERATOR,
                referenceField: properties.FIELD_DESCRIPTION,
                targetValue: properties.TARGET_VALUE,
                expression: properties.EXPRESSION ? properties.EXPRESSION : '$',
                leaf: true,
            };
            return newNode;
        } else if (node.type === 'CONDITION' && node.children![0].type === 'PARENTHESIS') {
            const conditionGroup = node.children!.filter((el) => el.type === 'CONDITION_GROUP');
            return conditionGroup[0];
        } else {
            return node;
        }
    }

    private removeEpsilon(node: INode): any {
        return ( { ...node, children: node.children!.filter((el) => {
            if (el.children && el.children[0].type === 'epsilon') {
                return false;
            } else {
                return true;
            }
        })} );
    }
}
