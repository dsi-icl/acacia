// import { Lexer } from './lexer/lexer';
// import { CST2IR } from './parser/cst2ir';
// import { Parser } from './parser/parser';
// import { Pipeline } from './generatePipeline';

// const string = 'value (field "Sex") = "Male" OR ( value (field "Age") = 30 AND value(field "Sex") = "Female" )';

// const lexer = new Lexer(string);
// const parser = new Parser(lexer.tokenize(true));
// const cst2ir = new CST2IR(parser.parse()).toIR();
// const pipeline = new Pipeline(cst2ir).generateMongoPipeline();
