To deploy the application on kubernetes, follow the following steps:

1. Take all the files in the sample folder and customise it. Common points to customise are `replicaSet` number and mongo `Service` CNAME record (by changing `ExternalName`) and similarly, objectStore `Service`.

2. Customise each config file in each package.

3. Create namespace on k8 cluster
```Bash
kubectl apply -f namespace-itmat.yaml
```

```Bash
kubectl get namespaces
```

4. Create Secrets/ConfigMaps with your config files for each package. These will be mounted to /config
```Bash
kubectl create secret generic {{packageName}}-config --from-file=./{{packagePath}}/config/config.json --namespace=itmat
```
Example:
```Bash
kubectl create secret generic itmat-api-config --from-file=./itmat-api/config.json --namespace=itmat
```

```Bash
kubectl get secrets
```

5. Create deployments of packages
```Bash
kubectl apply -f deployment-{{packageName}}.yaml
```

```Bash
kubectl get deployments
```

6. Create services of packages and for mongo and objectStore
```Bash
kubectl apply -f service-{{name}}.yaml
```

```Bash
kubectl get services
```
