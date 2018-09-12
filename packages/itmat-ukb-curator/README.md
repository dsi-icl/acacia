# itmat-UKB-curator

Curates the UKB clinical csv file;
Curation steps include:
    - Parsing the field headers to construct a tree structure of the fields, along with the field's visit time points and instances
    - Decode the coding of values in the CSV, if encoded
    - identifiy the numeric and string values
    - output COLUMN MAPPING FILE and MODIFIED CSV FILE; both sent to csv parser service to be uploaded to mongo
