import * as AWS from '../clients/all';
export abstract class ConfigurationServicePlaceholders {
  log?: AWS.Log.Types.ClientConfiguration;
  account?: AWS.Account.Types.ClientConfiguration;
  backup?: AWS.Backup.Types.ClientConfiguration;
  notification?: AWS.Notification.Types.ClientConfiguration;
  robot?: AWS.Robot.Types.ClientConfiguration;
  loop?: AWS.Loop.Types.ClientConfiguration;
  media?: AWS.Media.Types.ClientConfiguration;
  person?: AWS.Person.Types.ClientConfiguration;
  gqa?: AWS.GQA.Types.ClientConfiguration;
}
export interface ConfigurationServiceApiVersions {
  log?: AWS.Log.Types.apiVersion;
  account?: AWS.Account.Types.apiVersion;
  backup?: AWS.Backup.Types.apiVersion;
  notification?: AWS.Notification.Types.apiVersion;
  robot?: AWS.Robot.Types.apiVersion;
  loop?: AWS.Loop.Types.apiVersion;
  media?: AWS.Media.Types.apiVersion;
  person?: AWS.Person.Types.apiVersion;
  gqa?: AWS.GQA.Types.apiVersion;
}
