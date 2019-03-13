import React, { Component, Fragment } from 'react';
import { object } from 'prop-types';
import { Link, withRouter } from 'react-router-dom';
import MDX from '@mdx-js/runtime';
import Typography from '@material-ui/core/Typography';
import Entry from './Entry';
import components from '../components';
import HeaderWithAnchor from '../components/HeaderWithAnchor';

@withRouter
export default class Reference extends Component {
  static propTypes = {
    /**
     * The JSON object representation of api.json,
     * logs.json, or events.json.
     */
    json: object.isRequired,
  };

  render() {
    const { json } = this.props;
    const functionEntries =
      json.entries && json.entries.filter(({ type }) => type === 'function');
    const topicExchangeEntries =
      json.entries &&
      json.entries.filter(({ type }) => type === 'topic-exchange');
    const builtinLogTypes = json.types.filter(l =>
      l.type.startsWith('monitor.')
    );
    const serviceLogTypes = json.types.filter(
      l => !l.type.startsWith('monitor.')
    );

    return (
      <div>
        {json.title && <HeaderWithAnchor>{json.title}</HeaderWithAnchor>}
        {json.description && (
          <MDX components={components}>{json.description}</MDX>
        )}
        {topicExchangeEntries && Boolean(topicExchangeEntries.length) && (
          <Fragment>
            <HeaderWithAnchor type="h3">Exchanges</HeaderWithAnchor>
            {topicExchangeEntries.map(entry => (
              <Entry
                key={entry.name}
                type="topic-exchange"
                entry={entry}
                exchangePrefix={json.exchangePrefix}
                serviceName={json.serviceName}
              />
            ))}
          </Fragment>
        )}
        {functionEntries && Boolean(functionEntries.length) && (
          <Fragment>
            <HeaderWithAnchor type="h3">Functions</HeaderWithAnchor>
            <Typography>
              For more information on invoking the API methods described here,
              see <Link to="/docs/manual/design/apis">Using the APIs</Link> in
              the manual.
            </Typography>
            <br />
            {functionEntries.map(entry => (
              <Entry
                key={`${entry.name}-${entry.query}`}
                type="function"
                entry={entry}
                serviceName={json.serviceName}
              />
            ))}
          </Fragment>
        )}
        {serviceLogTypes && Boolean(serviceLogTypes.length) && (
          <Fragment>
            <HeaderWithAnchor type="h3">Service Message Types</HeaderWithAnchor>
            <Typography>
              For more information on interpreting the log types described here,
              see
              <Link to="/docs/manual/design/logs">Interpreting Log Types</Link>
              in the manual.
            </Typography>
            <br />
            {serviceLogTypes.map(entry => (
              <Entry
                key={`${entry.type}`}
                type="logs"
                entry={entry}
                serviceName={json.serviceName}
              />
            ))}
          </Fragment>
        )}
        {builtinLogTypes && Boolean(builtinLogTypes.length) && (
          <Fragment>
            <HeaderWithAnchor type="h3">
              Cluster-Wide Message Types
            </HeaderWithAnchor>
            <Typography>
              For more information on interpreting the log types described here,
              see
              <Link to="/docs/manual/design/logs">Interpreting Log Types</Link>
              in the manual.
            </Typography>
            <br />
            {builtinLogTypes.map(entry => (
              <Entry
                key={`${entry.type}`}
                type="logs"
                entry={entry}
                serviceName={json.serviceName}
              />
            ))}
          </Fragment>
        )}
      </div>
    );
  }
}
