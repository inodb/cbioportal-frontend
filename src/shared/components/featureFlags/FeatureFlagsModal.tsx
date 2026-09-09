import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action, makeObservable } from 'mobx';
import { Modal } from 'react-bootstrap';
import FontAwesome from 'react-fontawesome';
import classNames from 'classnames';
import { getServerConfig } from 'config/config';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import { FeatureFlagStore } from 'shared/FeatureFlagStore';
import {
    FeatureFlagEnum,
    getFeatureFlagDisplayInfo,
    isFeatureFlagOptable,
    isFeatureFlagRelevantForStudies,
    isFeatureFlagStudySpecific,
} from 'shared/featureFlags';
import { FeatureFlagsModalStore } from './FeatureFlagsModalStore';
import styles from './styles.module.scss';

export interface IFeatureFlagsModalProps {
    featureFlagStore: FeatureFlagStore;
    onHide: () => void;
}

@observer
export default class FeatureFlagsModal extends React.Component<
    IFeatureFlagsModalProps,
    {}
> {
    private store = new FeatureFlagsModalStore();
    @observable.ref private _selectedFlag: FeatureFlagEnum | undefined;

    constructor(props: IFeatureFlagsModalProps) {
        super(props);
        makeObservable(this);
    }

    private toggle(flag: string, enabled: boolean) {
        if (enabled) {
            this.props.featureFlagStore.remove(flag);
        } else {
            this.props.featureFlagStore.add(flag);
        }
    }

    @action.bound
    private selectFlag(flag: FeatureFlagEnum) {
        this._selectedFlag = flag;
    }

    private get visibleFlags(): FeatureFlagEnum[] {
        const appName = getServerConfig().app_name;
        const { accessibleStudyIds } = this.store;
        return Object.values(FeatureFlagEnum).filter(flag => {
            const { alwaysOn } = getFeatureFlagDisplayInfo(flag, appName);
            if (!(alwaysOn || isFeatureFlagOptable(flag, appName))) {
                return false;
            }
            if (isFeatureFlagStudySpecific(flag)) {
                if (accessibleStudyIds.isPending) {
                    return false;
                }
                return isFeatureFlagRelevantForStudies(
                    flag,
                    accessibleStudyIds.result!
                );
            }
            return true;
        });
    }

    private get selectedFlag(): FeatureFlagEnum | undefined {
        return this._selectedFlag ?? this.visibleFlags[0];
    }

    private renderDetail(flag: FeatureFlagEnum) {
        const appName = getServerConfig().app_name;
        const { featureFlagStore } = this.props;
        const enabled = featureFlagStore.has(flag);
        const { description, exampleUrl, alwaysOn } = getFeatureFlagDisplayInfo(
            flag,
            appName
        );
        const optable = isFeatureFlagOptable(flag, appName);

        return (
            <div className={styles.detail}>
                <div className={styles.detailHeader}>
                    <h4>{flag}</h4>
                    {optable ? (
                        <a
                            className={styles.switchLabel}
                            onClick={() => this.toggle(flag, enabled)}
                        >
                            <FontAwesome
                                name={enabled ? 'toggle-on' : 'toggle-off'}
                            />{' '}
                            {enabled ? 'On' : 'Off'}
                        </a>
                    ) : (
                        <span className={styles.badge}>
                            Always on for this portal
                        </span>
                    )}
                </div>
                <p className={styles.subtext}>
                    {description}
                    {alwaysOn && optable && (
                        <span>
                            {' '}
                            Already enabled by default for this portal.
                        </span>
                    )}
                </p>
                {exampleUrl && (
                    <div className={styles.meta}>
                        <a href={exampleUrl}>See an example</a>
                    </div>
                )}
                {optable && (
                    <p className={styles.subtext}>
                        Disabling a flag reloads the page to apply the change.
                    </p>
                )}
            </div>
        );
    }

    render() {
        const { featureFlagStore, onHide } = this.props;
        const flags = this.visibleFlags;
        const selected = this.selectedFlag;
        const isLoading = this.store.accessibleStudyIds.isPending;

        return (
            <Modal onHide={onHide} show={true}>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FontAwesome name="flask" /> Experimental Features
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className={styles.subtext}>
                        Get early access to features we're still working on.
                    </p>
                    {isLoading ? (
                        <LoadingIndicator isLoading={true} />
                    ) : (
                        <div className={styles.layout}>
                            <ul className={styles.sidebar}>
                                {flags.map(flag => (
                                    <li
                                        key={flag}
                                        className={classNames({
                                            [styles.selected]:
                                                flag === selected,
                                        })}
                                        onClick={() => this.selectFlag(flag)}
                                    >
                                        <FontAwesome
                                            name={
                                                featureFlagStore.has(flag)
                                                    ? 'toggle-on'
                                                    : 'toggle-off'
                                            }
                                        />{' '}
                                        {flag}
                                    </li>
                                ))}
                            </ul>
                            {selected && this.renderDetail(selected)}
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        );
    }
}
