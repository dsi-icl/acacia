mod data;
mod event_handlers;

use kafka::consumer::{Consumer, FetchOffset, GroupOffsetStorage};
use mongodb::bson::doc;
use mongodb::{options::ClientOptions, Client};
use std::error::Error;
use std::sync::{Arc, Mutex};

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Parse a connection string into an options struct.
    let mut client_options = ClientOptions::parse("mongodb://localhost:27017").await?;

    //Manually set an option.
    client_options.app_name = Some("acacia-data-service".to_string());

    // Get a handle to the deployment.
    let client = Client::with_options(client_options)?;

    let db = client.database("local");
    // List the names of the databases in that deployment.
    let collection = Arc::new(Mutex::new(db.collection("clinical_data")));

    let mut consumer = Consumer::from_hosts(vec!["localhost:32769".to_owned()])
        .with_topic_partitions("data_upload_test".to_owned(), &[0])
        .with_fallback_offset(FetchOffset::Earliest)
        //.with_group("my-group".to_owned())
        //.with_offset_storage(GroupOffsetStorage::Kafka)
        //.with_fetch_min_bytes(1)
        .create()
        .unwrap();
    println!("hereee");
    loop {
        for ms in consumer.poll().unwrap().iter() {
            for m in ms.messages() {
                println!("here :{:?}", m);
                event_handlers::data_upload_event_handler(m.value, collection.clone()).await;
            }
            consumer.consume_messageset(ms);
        }
        consumer.commit_consumed().unwrap();
    }
}
