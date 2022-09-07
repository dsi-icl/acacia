export const options: any = {
    ops: ['=', '!=', '<', '>', '>=', '<='],
    tagColors: {
        visit: 'red',
        race: 'volcano',
        genderID: 'cyan',
        siteID: 'orange',
        mh: 'blue',
        cm: 'lime',
        filters: 'purple'
    }
};

export const statisticsTypes: string[] = [
    'ttest', 'ztest'
];

export const analysisTemplate: any = {
};

export const dataTypeMapping: any = {
    int: 'Integer',
    dec: 'Decimal',
    str: 'String',
    bool: 'Boolean',
    date: 'Datetime',
    file: 'File',
    json: 'JSON',
    cat: 'Categorical'
};
