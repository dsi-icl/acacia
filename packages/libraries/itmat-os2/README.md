[![Total alerts](https://img.shields.io/lgtm/alerts/g/dsi-icl/itmat-broker.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/dsi-icl/itmat-broker/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/dsi-icl/itmat-broker.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/dsi-icl/itmat-broker/context:javascript)
[![Mutation testing badge](https://img.shields.io/endpoint?style=flat&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fitmat%2Fitmat-commons%2Fmaster)](https://dashboard.stryker-mutator.io/reports/github.com/dsi-icl/itmat-broker/master)
![Build status](https://github.com/dsi-icl/itmat-broker/workflows/Node.js%20CI/badge.svg)
[![Dependency Status](https://img.shields.io/david/dsi-icl/itmat-broker.svg)](https://david-dm.org/dsi-icl/itmat-broker)
[![devDependency Status](https://img.shields.io/david/dev/dsi-icl/itmat-broker.svg)](https://david-dm.org/dsi-icl/itmat-broker?type=dev)

# os²
OpenStack Object Storage wrapper for Node.js 
---------------------------------------------

_This package is base on the work by Jean Grizet at https://github.com/Tezirg/os2_

os² is a wrapper for the [OpenStack Object Storage API v1](https://developer.openstack.org/api-ref/object-storage/index.html).
Use it to communicate with an Object Storage via it's REST api without managing the HTTP requests.

## Features
  * Abstractions to write and read data from an Object Storage using Node.js streams. 
  * Authentication to the OpenStack Object Storage using the [TempAuth](https://docs.openstack.org/swift/latest/overview_auth.html#temp-auth) method. (No production, contributions are welcome)
  * Asynchronous communication using ES6 Promise
  * Support for [Large Objects](https://docs.openstack.org/swift/latest/api/large_objects.html)

## Getting started

### Installation
Installing globally from the npm package manager:
```bash
npm install os2 --global
```

Or add os² as a dependency to a node.js project using the `package.json` file:
```json
"dependencies": {
  "@itmat/os2": "*"
}
```
and then update the project's dependencies
```bash
npm install
```
### Build the library

Building the library is easy. First run `yarn install && yarn run build`, to build the application. Artifacts will be rendered in the `/dist` folder as the root of your clone.

### Import
Import os² components as any Node.js package. For example,
all os² components at once :
```javascript
const os2 = require('@itmat/os2');
```
Or, to import os² components separately:
```javascript
// pick only what you need, lol
const { Store, Account, Container, Segment, DynamicLargeObject, StaticLargeObject } = require('@itmat/os2');
```

### Example
```javascript
// First, create a Store to connect to
let store = new Store('http://example.openstackobjectstorage:8080/');
    
// Then, make an account, give it the store and the credentials
let account = new Account(store, 'username', 'password');
    
// Authenticate with tempAuth
account.connect().then(function() {
    
        //We can now create containers using the connected account
        let container = new Container(account, 'example_container');
        
        //Perform the container creation on the object storage API
        container.create().then(function() {
    
            //Create an object inside the container
            let obj = new Segment(container, 'example_segment');
                
            //Put the content of a file into: example_container/example_segment
            obj.createFromDisk('./path/to/my/file.txt').then(function(ok) {
               // Yeah the file is created ! 
            });
        });
    });
```

## Quick reference
1. [Store](#store)
2. [Account](#account)
3. [Container](#contrainer)
4. [Segment](#segment)
5. [Dynamic Large Object](#DLO)
6. [Static Large Object](#SLO)
7. [Error handling](#error)


## Store
A Store instance represents the Object Storage API service. It is defined by a URL of where the service is hosted.

### Methods

#### new Store(\[url\])
 Create a new store from a URL.
* `url` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>
 Object storage API url. Defaults to `http://127.0.0.1`
#### info()
Attempts to list activated capabilities on this Store, will fail if not configured on OpenStack.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\> 
`resolves` to \<[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)\>
 a json object containing the list of capabilities on success, 
or `rejects` with a \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\>.
 
### Properties
   * `URL` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>: The URL in use by this Store can be read using `getUrl` and updated with `setUrl`



## Account
Your service provider creates your account and you own all resources in that account.
The account defines a namespace for containers. In the OpenStack environment, account is synonymous with a project or tenant.

### Methods
#### new Account(store, [username, [password, [storage_url, [token]]]])
Create a new \<[Account](#account)\> instance, main constructor.
* `store` \<[Store](#store)\> os² Store instance where the account resides.
* `username` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Username used authenticate. Defaults to `null`.
* `password` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Password used authenticate. Defaults to `null`.
* `storage_url` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> URL pointing to this account storage API.
* `storage_token` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Authentication token to use when querying the API.

#### Account.fromUsernameAndPassword(storeUrl, username, password)
Alternative constructor for construction from a URL and a username/password.
 * `storeUrl` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>
 An OpenStack Object Storage URL.
 * `username` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>
 Username used for authentication.
 * `password` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>
 Password used for authentication.
 
Returns a new \<[Account](#Account)\> instance.

#### Account.fromNameAndToken(storeUrl, name, token)
Alternative constructor for construction from a URL and an account name and authentication token
 * `storeUrl` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>
 An OpenStack Object Storage URL.
  * `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>
 As used by OpenStack in this account storage URL.
  * `token` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>
A valid authentication token to connecting this account.

Returns a new \<[Account](#Account)\> instance.

#### connect()
Performs this account connection with the Store. Uses the /auth/v1.0 authentication mechanism of swift object storage

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>, which `resolves` to true on success or `rejects` 
a native \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> on failure.

#### disconnect()
Disconnects this account from the store.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\> that always resolves to true.

#### listContainers()
List all the containers in this account.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\> that resolves to a json array of containers on success, 
rejects a native \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise.

#### getMetadata()
Retrieve stored metadata for this account, MUST be connected.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. Resolves to an object containing all the metadata on success, 
reject an \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise

#### setMetadata(metadata)
Update metadata for this account. Omitted metadata items are unchanged, 
metadata items with `null` or `undefined` values are removed.
* `metadata` \<[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)\>
each property is considered to be a metadata item.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
`Resolves` to true on success, `rejects` a native js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> on failure

### Properties
 * `connected` \<[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)\> Account's connection status. `True` if a valid authentication has been performed. Access it with `isConnected`
 * `store` \<[Store](#Store)\> An account is backed by a store instance. `getStore` and `setStore` are available.
 * `username` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Username used for authentication. `getUsername` and `setUsername`  
 * `password` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Password used for authentication. `getPassword` and `setPassword` 
 * `token` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Authentication token from the store tempAuth. This property is read only: `getToken`
 * `storageUrl` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Once authenticated, url where this account objects are. Read only : `getStorageUrl`
 * `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Name of the account in the store, exctracted from `strorageUrl` or passed at contruction. Read only: `getName`

## Container
Defines a namespace for objects. An object with the same name in two different containers represents two different objects. There can be any number of containers within an account.
### Methods
#### new Container(account, name)
Creates a new Container instance. 
* `account` \<[Account](#account)\> A valid instance of Account the new container will belong to.
* `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Is the namespace representing the container on the object store.
    
#### create()
Creates or updates the container instance in the object storage.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\> which `resolves` to the object storage response on success, on error it `rejects` a native js Error.

####  delete()
Delete the container instance in the object storage.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\> which `resolves` to the object storage response on success, on error it `rejects` a native js Error.

#### setMetadata(metadata)
Update metadata associated with the container. Omitted metadata items are unchanged, 
metadata items with `null` or `undefined` values are removed.
* `metadata` \<[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)\>
each property is considered to be a metadata item.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
and `resolves` to true on success, `rejects` a native js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> on failure

#### getMetadata()
Retrieve the stored metadata in this container.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. Resolves to an object containing all the metadata on success, 
reject an \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise

#### listObjects()
Get details and objects list from the container.
Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\> which `resolves` to the json content of the container 
or `rejects` an \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> instance.

### Properties
 * `account` \<[Account](#Account)\> A valid Account instance where the container belongs. `getAccount` and `setAccount` are available.
 * `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> The container identifier. `getName` and `setName` are available.


## Segment
Stores data content, such as documents, images, and so on. You can also store custom metadata with an object.
### Methods
#### new Segment(container, name)
Create a new Segment/Object in the container. 
 * `container` \<[Container](#container)\> An instance of a container for the Segment
 * `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> As the name or identifier for the Segment


####  createFromDisk(filepath)
Assign the segment's content from a file on disk, replaces its content if already exists.
* `filepath` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\>  Absolute or relative path to the file on disk

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. It `resolves` to true on success, on error it `rejects` a \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

#### createFromStream(readStream)
Assign the segment's content from stream, replaces its content if already exists
* `readStream` Segment content in the form of a Node.js \<[stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)\>
 instance
 
Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. It `resolves` to true on success, on error it `rejects` a \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

#####  delete()
Delete this object form the Object Storage.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. It `resolves` to true on success, on error it `rejects` a \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

#####  copy
Copies this object to the destination object.
If the destination object is already created in the Object storage, it is replaced
If the source segment is a Large Object, the manifest is copied, referencing the same content.
* `object` \<[Segment](#segment)\> As a destination object

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. It `resolves` to true on success, on error it `rejects` a \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\>


#####  getContentStream()
Get a stream readable on the segment content

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. It `resolves` to a \<[stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)\>
on success. A javascript \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> is `rejected` on error.

#### setMetadata(metadata)
Update metadata associated with the Segment. Omitted metadata items are unchanged, 
metadata items with `null` or `undefined` values are removed.
* `metadata` \<[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)\>
each property is considered to be a metadata item.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
and `resolves` to true on success, `rejects` a native js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> on failure

#### getMetadata()
Retrieve the stored metadata with this segment.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. Resolves to an object containing all the metadata on success, 
reject an \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise

### Properties
* `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Identifier or name for the segment. `getName` and `setName` methods are provided.
* `container` \<[Container](#container)\> An instance of a container the segment is stored into. `getContainer` and `setContainer`are available. 

## DLO
A DynamicLargeObject contains multiple Segments. It is defined by a container: where the segment objects are stored; and a prefix: a string that all segment objects have in common.
### Methods 
#### new DynamicLargeObject(container, name, [prefix]) {
Create a new DynamicLargeObject or DLO. 
 * `container` \<[Container](#container)\> An instance of a container for the DLO
 * `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> As the name or identifier of the DLO

####  createManifest()
Creates or updates this DLO manifest

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
and `resolves` to true on success, `rejects` a js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise.

### createFromStream
Creates a SLO from a single stream.
* `stream` \<[stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)\> A readable stream providing the content
* `chunkSize` <Integer> Optional maximum size of the generated segments. Default and max to 1Go

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
`Resolves` to a map of segments:status on success and `rejects` a js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise.


####  createFromDisk(filePath[, chunkSize])
Create a dlo from a file on disk. The file gets split in segments if needed.
* `path` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> Path of the source file on the disk.
* `chunkSize` Optional maximum size of the generated segments. Default to 5Go.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
`Resolves` to a map of segments:status on success and `rejects` a js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise.

####  createFromStreams(streams)
Create a DLO from multiple data streams, where each stream is stored as a segment.
The created DLO contains the concatenated content of the streams, ordered as received
* `streams` \<[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)\> An array of streams to get the data from.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
`Resolves` to a map of segments:status on success and `rejects` a js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise.
 
####  getContentStream([manifest])
Get the DLO content or its manifest content.
* `manifest` \<[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)\>
Set to true to get the manifest, false for the content. Defaults to `false`.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. It `resolves` to a \<[stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)\>
on success. A javascript \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> is `rejected` on error.

### Inherited methods from `Segment`
* `delete`
* `copy`
* `getMetadata`
* `setMetadata`

### Properties
* `prefix` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> A DLO has a prefix to identify which segments are part of the DLO.
Accessors are `getPrefix` and `setPrefix`.

### Inherited properties from `Segment`
* `name` 
* `container` 

## SLO
A StaticLargeObject contains multiple segments, and is defined by a manifest.
### Methods
#### new StaticLargeObject(container, name)
Creates a new StaticLargeObject or SLO.
* `container` \<[Container](#container)\> An instance of a container for the SLO
* `name` \<[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)\> As the name or identifier of the SLO.

#### createManifest(manifestContent)
Creates or updates this SLO manifest
* `manifestContent` A json \<[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)\>, where each element is an object representing a segment. These objects may contain the following attributes:
  * `path` (required). The container and object name in the format: {container-name}/{object-name}
  * `etag` (optional). If provided, this value must match the ETag of the segment object. This was included in the response headers when the segment was created. Generally, this will be the MD5 sum of the segment.
  * `size_bytes` (optional). The size of the segment object. If provided, this value must match the Content-Length of that object.
  * `range` (optional). The subset of the referenced object that should be used for segment data. This behaves similar to the Range header. If omitted, the entire object will be used.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
and `resolves` to true on success, `rejects` a native js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> on failure

### createFromStream
Creates a SLO from a single stream.
* `stream` \<[stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)\> A readable stream providing the content
* `chunkSize` <Integer> Optional maximum size of the generated segments. Default and max to 1Go

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
`Resolves` to a map of segments:status on success and `rejects` a js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise.
 
#### createFromStreams(streams)
Create a SLO from multiple data streams, where each stream is stored as a segment.
The created SLO contains the concatenated content of the streams, ordered as received
* `streams` \<[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)\> An array of streams to get the data from.

Returns \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
`Resolves` to a map of segments:status on success and `rejects` a js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> otherwise.

#### getContentStream([manifest])
Get the SLO content or its manifest content.
* `manifest` \<[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)\>
Set to true to get the manifest, false for the content. Defaults to `false`.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>. It `resolves` to a \<[stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)\>
on success. A javascript \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> is `rejected` on error.

#### deleteWithContent()
Delete the static large object and the segments it refers to.

Returns a \<[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)\>.
and `resolves` to true on success, `rejects` a native js \<[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)\> on failure

### Inherited methods from `Segment`
* `delete`
* `copy`
* `getMetadata`
* `setMetadata`

### Inherited methods from `DynamicLargeObject`
* `createFromDisk`
* `createFromStream`

### Inherited properties from `Segment`
* `name` 
* `container` 

## Error
When an operation on the Object Storage API timeouts or the HTTP status code indicates an error, the Promise will `reject` a native javascript `Error` containing an error message.
```javascript
let account = new Account(example_store, username, password);
account.connect().then(function() {
  // Code here
}, function (error) {
console.error(error.toString());
});
```

## Contributing
Pull requests are welcome!
See the [list of open issues](https://github.com/dsi-icl/itmat-broker/issues) to get an idea of what you could work on.
Or, if you have an awesome idea, please [create a new issue](https://github.com/dsi-icl/itmat-broker/issues/new).