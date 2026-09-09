import * as React from 'react';
import { observer } from 'mobx-react';
import FontAwesome from 'react-fontawesome';
import { FeatureFlagEnum } from 'shared/featureFlags';
import { FeatureFlagStore } from 'shared/FeatureFlagStore';
import styles from './styles.module.scss';

interface IFeatureFlagsSectionProps {
    featureFlagStore: FeatureFlagStore;
}

@observer
export default class FeatureFlagsSection extends React.Component<
    IFeatureFlagsSectionProps,
    {}
> {
    private toggle(flag: string, enabled: boolean) {
        if (enabled) {
            this.props.featureFlagStore.remove(flag);
        } else {
            this.props.featureFlagStore.add(flag);
        }
    }

    render() {
        const flags = Object.values(FeatureFlagEnum);
        return (
            <div className={styles.card}>
                <h4>
                    <FontAwesome name="flask" /> Feature Flags
                </h4>
                <p className={styles.subtext}>
                    Experimental features you've opted into. Disabling a flag
                    reloads the page to apply the change.
                </p>
                <ul className={styles.flagList}>
                    {flags.map(flag => {
                        const enabled = this.props.featureFlagStore.has(flag);
                        return (
                            <li key={flag}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={() =>
                                            this.toggle(flag, enabled)
                                        }
                                    />{' '}
                                    {flag}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }
}
