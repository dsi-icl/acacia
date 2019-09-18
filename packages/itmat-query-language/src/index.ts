import { Lexer } from './lexer';
import { Parser } from './parser';
import { CST2IR } from './cst2ir';
import { Pipeline } from './generatePipeline';

const string = 'value (field "Sex") = "Male" OR ( value (field "Age") = 30 AND value(field "Sex") = "Female" )';

const lexer = new Lexer(string);
const parser = new Parser(lexer.tokenize(true));
const cst2ir = new CST2IR(parser.parse()).toIR();
const pipeline = new Pipeline(cst2ir).generateMongoPipeline();