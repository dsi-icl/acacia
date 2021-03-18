use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug)]
pub struct DataPoint {
    id: String,
    #[serde(rename = "f")]
    field_id: String,
    #[serde(rename = "t")]
    time_point: String,
    #[serde(rename = "v")]
    value: String,
}

#[derive(Debug)]
pub enum ParseRowError {
    UnexpectedNumOfColumn(usize),
}

pub fn convert_row_to_data_point(row: &[String]) -> Result<DataPoint, ParseRowError> {
    if row.len() != 3 {
        return Err(ParseRowError::UnexpectedNumOfColumn(row.len()));
    }
    Ok(DataPoint {
        id: Uuid::new_v4().to_string(),
        field_id: row[0].clone(),
        time_point: row[1].clone(),
        value: row[2].clone(),
    })
}
