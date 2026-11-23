# GCP permissions

Status: done

Org `vespra.cloud` (`216186333252`). Account `austin@vespra.cloud` is the only person, so roles stay on that user.

## What changed

Anyone in the domain could create projects and billing accounts. Those two org roles are now only on `austin@vespra.cloud`:

- `roles/resourcemanager.projectCreator`
- `roles/billing.creator`

`roles/resourcemanager.folderEditor` was removed from the Production, Shared Services, and Nonproduction folders. `roles/resourcemanager.folderAdmin` on the same user covers that.

## divine-haiku-05wls

This project is not in `vespra.cloud`. Its parent organization is `71994629047`, which this account cannot view. The only permission here is `resourcemanager.projects.get`. It cannot be moved, deleted, or removed from the project list from this account. Leave it.

## Left alone

- Project owners were not removed. `austin@vespra.cloud` is still owner of the three Vespra projects.
- Group bindings on Platform Production stay. Groups such as `cloud-admins@vespra.cloud` are already in use there.
- `vespra-infrastructure` still has its Terraform state bucket, a Secret Manager secret, a user-managed key on the default Compute Engine service account, and a long list of enabled APIs. Those were not changed.
- No VM was created. LiteLLM and its database were not changed.

## Undo

```bash
gcloud organizations add-iam-policy-binding 216186333252 \
  --member=domain:vespra.cloud --role=roles/resourcemanager.projectCreator
gcloud organizations add-iam-policy-binding 216186333252 \
  --member=domain:vespra.cloud --role=roles/billing.creator
```
