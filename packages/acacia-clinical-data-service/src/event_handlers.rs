use crate::data;
use kafka::consumer::Message;
use mongodb::bson;
use mongodb::{options, Collection};
use std::str;
use std::sync::{Arc, Mutex};

pub async fn data_upload_event_handler(msg: &[u8], collection: Arc<Mutex<Collection>>) {
    let mock_data: Vec<Vec<String>> = vec![
        vec![
            "fddsf".to_string(),
            "fdsfs".to_string(),
            "fdsf21rw".to_string(),
        ],
        vec![
            "fddsf".to_string(),
            "fdsfs".to_string(),
            "fdsf21rw".to_string(),
        ],
        vec![
            "fddsf".to_string(),
            "fdsfs".to_string(),
            "fdsf21rw".to_string(),
        ],
        vec![
            "fddsf".to_string(),
            "fdsfs".to_string(),
            "fdsf21rw".to_string(),
        ],
        vec![
            "fddsf".to_string(),
            "fdsfs".to_string(),
            "fdsf21rw".to_string(),
        ],
        vec![
            "fddsf".to_string(),
            "fdsfs".to_string(),
            "fdsf21rw".to_string(),
        ],
        vec![
            "fddsf".to_string(),
            "fdsfs".to_string(),
            "fdsf21rw".to_string(),
        ],
    ];
    match str::from_utf8(&msg) {
        Ok(value) => {
            println!("{}", value);
            // fetch files from obj store

            // curate data points
            let mut data_vec = vec![];
            for each in mock_data {
                data_vec.push(
                    bson::to_bson(&data::convert_row_to_data_point(&each).unwrap())
                        .unwrap()
                        .as_document()
                        .unwrap()
                        .clone(),
                );
            }

            // upload to mongo
            let insert_result = collection
                .lock()
                .unwrap()
                .insert_many(
                    data_vec,
                    Some(
                        options::InsertManyOptions::builder()
                            .write_concern(
                                options::WriteConcern::builder()
                                    .w(options::Acknowledgment::Majority)
                                    .build(),
                            )
                            .build(),
                    ),
                )
                .await;

            // send FINSIHED_PROCESSING to KAFKA
        }
        Err(e) => {
            println!("cannot parse");
        }
    }
}
