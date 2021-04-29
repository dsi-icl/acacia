import json
array = [['ID', 'SubjectID', 'VisitID', 'Sex', 'Description', 'Weight', 'UNKNOWN']]
with open('JSONCurator_error5.json', 'a') as f:
    for i in range(1, 2227):
        array.append([str(i), 'I7N3G6G', str(i), 0, 'no description', 60.2, 1])
    json.dump(array, f)