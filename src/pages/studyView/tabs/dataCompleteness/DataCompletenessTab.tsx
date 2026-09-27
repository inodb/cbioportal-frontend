import * as React from 'react';
import _ from 'lodash';
import { observer } from 'mobx-react';
import { action, computed, makeObservable, observable } from 'mobx';
import classnames from 'classnames';
import { CancerStudy } from 'cbioportal-ts-api-client';
import LazyMobXTable, {
    Column,
    SortDirection,
} from 'shared/components/lazyMobXTable/LazyMobXTable';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import { StudyViewPageStore } from '../../StudyViewPageStore';
import { DataCompletenessStore } from './DataCompletenessStore';
import {
    ClinicalCompletenessRow,
    CompletenessLevel,
    completenessBarColor,
    completenessColor,
    completenessFraction,
    Coverage,
    CoverageRow,
    formatPercent,
    GenePanelCompletenessRow,
    NO_GENE_PANEL_LABEL,
    ProfileCompletenessRow,
    StudyCoverage,
} from './DataCompletenessUtils';
import styles from './dataCompleteness.module.scss';

export interface IDataCompletenessTabProps {
    store: StudyViewPageStore;
}

enum Section {
    CLINICAL = 'clinical',
    PROFILES = 'profiles',
    GENE_PANELS = 'genePanels',
}

type LevelFilter = 'all' | CompletenessLevel;

class ClinicalTable extends LazyMobXTable<ClinicalCompletenessRow> {}
class ProfileTable extends LazyMobXTable<ProfileCompletenessRow> {}
class GenePanelTable extends LazyMobXTable<GenePanelCompletenessRow> {}

const COMPLETENESS_COLUMN = 'Completeness';

const CompletenessBar: React.FunctionComponent<{
    coverage: Coverage;
    unit: string;
    // width of the widest possible count, so counts right-align across rows
    countWidthCh: number;
}> = ({ coverage, unit, countWidthCh }) => {
    const fraction = completenessFraction(coverage);
    return (
        <div
            className={styles.completeness}
            title={`${coverage.withData.toLocaleString()} of ${coverage.total.toLocaleString()} ${unit} have data`}
            data-test="completeness-bar"
        >
            <div className={styles.barTrack}>
                <div
                    className={styles.barFill}
                    style={{
                        width: `${fraction * 100}%`,
                        backgroundColor: completenessBarColor(fraction),
                    }}
                />
            </div>
            <span className={styles.percent}>{formatPercent(fraction)}</span>
            <span className={styles.counts}>
                <span
                    className={styles.count}
                    style={{ minWidth: `${countWidthCh}ch` }}
                >
                    {coverage.withData.toLocaleString()}
                </span>
                {' / '}
                {coverage.total.toLocaleString()}
            </span>
        </div>
    );
};

const StudyCell: React.FunctionComponent<{
    coverage: StudyCoverage | undefined;
    studyName: string;
    unit: string;
}> = ({ coverage, studyName, unit }) => {
    if (!coverage || coverage.total === 0) {
        return <span className={styles.studyCellEmpty}>—</span>;
    }
    if (!coverage.available) {
        return (
            <span
                className={styles.studyCellUnavailable}
                title={`Not available in ${studyName}`}
            >
                n/a
            </span>
        );
    }
    const fraction = completenessFraction(coverage);
    return (
        <span
            className={styles.studyCell}
            style={{ backgroundColor: completenessColor(fraction) }}
            title={`${studyName}: ${coverage.withData.toLocaleString()} of ${coverage.total.toLocaleString()} ${unit}`}
        >
            {formatPercent(fraction)}
        </span>
    );
};

function coverageDownload(coverage: StudyCoverage | Coverage | undefined) {
    if (!coverage) {
        return '';
    }
    if ('available' in coverage && !coverage.available) {
        return 'n/a';
    }
    return `${coverage.withData}/${coverage.total}`;
}

@observer
export class DataCompletenessTab extends React.Component<
    IDataCompletenessTabProps,
    {}
> {
    private completenessStore: DataCompletenessStore;

    @observable private section: Section = Section.CLINICAL;
    @observable private levelFilter: LevelFilter = 'all';
    @observable private onlyIncomplete = false;

    constructor(props: IDataCompletenessTabProps) {
        super(props);
        makeObservable(this);
        this.completenessStore = new DataCompletenessStore(props.store);
    }

    @computed get studyIds() {
        return this.completenessStore.selectedStudyIds;
    }

    @computed get isMultiStudy() {
        return this.studyIds.length > 1;
    }

    @computed get studyIdToStudy(): { [studyId: string]: CancerStudy } {
        return this.props.store.studyIdToStudy.result || {};
    }

    @computed get countWidthCh() {
        return this.props.store.selectedSamples.result.length.toLocaleString()
            .length;
    }

    private studyName(studyId: string) {
        return this.studyIdToStudy[studyId]?.name || studyId;
    }

    private studyColumns<T extends CoverageRow>(unit: (d: T) => string) {
        if (!this.isMultiStudy) {
            return [];
        }
        return this.studyIds.map(
            (studyId): Column<T> => ({
                id: `study_${studyId}`,
                name: this.studyName(studyId),
                headerRender: () => (
                    <span
                        className={styles.studyHeader}
                        title={`${this.studyName(studyId)} (${studyId})`}
                    >
                        {this.studyName(studyId)}
                    </span>
                ),
                align: 'center',
                render: (d: T) => (
                    <div className={styles.alignCenter}>
                        <StudyCell
                            coverage={d.byStudy[studyId]}
                            studyName={this.studyName(studyId)}
                            unit={unit(d)}
                        />
                    </div>
                ),
                sortBy: (d: T) => {
                    const c = d.byStudy[studyId];
                    return c && c.available ? completenessFraction(c) : -1;
                },
                download: (d: T) => coverageDownload(d.byStudy[studyId]),
                defaultSortDirection: 'desc' as SortDirection,
                togglable: true,
            })
        );
    }

    private completenessColumn<T extends CoverageRow>(
        unit: (d: T) => string
    ): Column<T> {
        return {
            name: COMPLETENESS_COLUMN,
            render: (d: T) => (
                <CompletenessBar
                    coverage={d}
                    unit={unit(d)}
                    countWidthCh={this.countWidthCh}
                />
            ),
            sortBy: (d: T) => [completenessFraction(d), d.withData],
            download: (d: T) => formatPercent(completenessFraction(d)),
            defaultSortDirection: 'desc' as SortDirection,
            width: 290,
        };
    }

    private countColumns<T extends CoverageRow>(): Column<T>[] {
        return [
            {
                name: 'With data',
                render: (d: T) => (
                    <div className={styles.number}>
                        {d.withData.toLocaleString()}
                    </div>
                ),
                sortBy: (d: T) => d.withData,
                download: (d: T) => `${d.withData}`,
                align: 'right',
                visible: false,
                togglable: true,
            },
            {
                name: 'Missing',
                render: (d: T) => (
                    <div className={styles.number}>
                        {(d.total - d.withData).toLocaleString()}
                    </div>
                ),
                sortBy: (d: T) => d.total - d.withData,
                download: (d: T) => `${d.total - d.withData}`,
                align: 'right',
                togglable: true,
            },
        ];
    }

    @computed get clinicalColumns(): Column<ClinicalCompletenessRow>[] {
        const unit = (d: ClinicalCompletenessRow) =>
            d.level === CompletenessLevel.PATIENT ? 'patients' : 'samples';
        return [
            {
                name: 'Attribute',
                render: d => (
                    <span
                        className={styles.attributeName}
                        title={d.attribute.description}
                    >
                        {d.attribute.displayName}
                        <span className={styles.attributeId}>
                            {d.attribute.clinicalAttributeId}
                        </span>
                    </span>
                ),
                sortBy: d => d.attribute.displayName,
                filter: (d, _f, upper) =>
                    d.attribute.displayName.toUpperCase().includes(upper!) ||
                    d.attribute.clinicalAttributeId
                        .toUpperCase()
                        .includes(upper!),
                download: d => d.attribute.displayName,
                width: 280,
            },
            {
                name: 'Attribute ID',
                render: d => <span>{d.attribute.clinicalAttributeId}</span>,
                sortBy: d => d.attribute.clinicalAttributeId,
                download: d => d.attribute.clinicalAttributeId,
                visible: false,
                togglable: true,
            },
            {
                name: 'Level',
                render: d => (
                    <span
                        className={classnames(
                            styles.levelBadge,
                            d.level === CompletenessLevel.PATIENT
                                ? styles.levelPatient
                                : styles.levelSample
                        )}
                    >
                        {d.level}
                    </span>
                ),
                sortBy: d => d.level,
                filter: (d, _f, upper) =>
                    d.level.toUpperCase().includes(upper!),
                download: d => d.level,
            },
            {
                name: 'Type',
                render: d => (
                    <span className={styles.muted}>
                        {_.capitalize(d.attribute.datatype)}
                    </span>
                ),
                sortBy: d => d.attribute.datatype,
                download: d => d.attribute.datatype,
                togglable: true,
            },
            this.completenessColumn<ClinicalCompletenessRow>(unit),
            ...this.countColumns<ClinicalCompletenessRow>(),
            ...this.studyColumns<ClinicalCompletenessRow>(unit),
        ];
    }

    @computed get profileColumns(): Column<ProfileCompletenessRow>[] {
        const unit = () => 'samples';
        return [
            {
                name: 'Molecular profile',
                render: d => (
                    <span className={styles.attributeName}>
                        {d.label}
                        <span className={styles.attributeId}>
                            {d.profileKey}
                        </span>
                    </span>
                ),
                sortBy: d => d.label,
                filter: (d, _f, upper) =>
                    d.label.toUpperCase().includes(upper!) ||
                    d.profileKey.toUpperCase().includes(upper!) ||
                    d.category.toUpperCase().includes(upper!),
                download: d => d.label,
                width: 340,
            },
            {
                name: 'Data type',
                render: d => <span className={styles.muted}>{d.category}</span>,
                sortBy: d => d.category,
                download: d => d.category,
            },
            this.completenessColumn<ProfileCompletenessRow>(unit),
            ...this.countColumns<ProfileCompletenessRow>(),
            ...this.studyColumns<ProfileCompletenessRow>(unit),
        ];
    }

    @computed get genePanelColumns(): Column<GenePanelCompletenessRow>[] {
        const unit = () => 'samples';
        const panels = this.completenessStore.genePanels.result;
        const genesInPanel = (d: GenePanelCompletenessRow) =>
            d.genePanelId ? panels[d.genePanelId]?.genes?.length : undefined;
        return [
            {
                name: 'Gene panel',
                render: d => (
                    <span
                        className={styles.attributeName}
                        title={
                            d.genePanelId
                                ? panels[d.genePanelId]?.description
                                : undefined
                        }
                    >
                        {d.genePanelId || (
                            <span className={styles.muted}>
                                {NO_GENE_PANEL_LABEL}
                            </span>
                        )}
                    </span>
                ),
                sortBy: d => d.genePanelId || '',
                filter: (d, _f, upper) =>
                    (d.genePanelId || NO_GENE_PANEL_LABEL)
                        .toUpperCase()
                        .includes(upper!) ||
                    d.profiles.some(p =>
                        p.category.toUpperCase().includes(upper!)
                    ),
                download: d => d.genePanelId || NO_GENE_PANEL_LABEL,
                width: 240,
            },
            {
                name: 'Genes',
                render: d => (
                    <div className={styles.number}>
                        {genesInPanel(d)?.toLocaleString() ?? ''}
                    </div>
                ),
                sortBy: d => genesInPanel(d) ?? null,
                download: d => `${genesInPanel(d) ?? ''}`,
                align: 'right',
            },
            {
                name: 'Used for',
                render: d => (
                    <span className={styles.profileUsage}>
                        {d.profiles.map(p => (
                            <span
                                key={p.profileKey}
                                className={styles.profileChip}
                                title={`${
                                    p.label
                                }: ${p.samples.toLocaleString()} samples`}
                            >
                                {p.category}
                            </span>
                        ))}
                    </span>
                ),
                sortBy: d => d.profiles.map(p => p.category).join(', '),
                download: d =>
                    d.profiles
                        .map(p => `${p.category} (${p.samples})`)
                        .join('; '),
                width: 300,
            },
            {
                ...this.completenessColumn<GenePanelCompletenessRow>(unit),
                name: 'Samples with panel',
            },
            ...this.studyColumns<GenePanelCompletenessRow>(unit),
        ];
    }

    @computed get filteredClinicalRows() {
        return this.completenessStore.clinicalRows.result.filter(
            d =>
                (this.levelFilter === 'all' || d.level === this.levelFilter) &&
                (!this.onlyIncomplete || d.withData < d.total)
        );
    }

    @computed get filteredProfileRows() {
        return this.completenessStore.profileRows.result.filter(
            d => !this.onlyIncomplete || d.withData < d.total
        );
    }

    @action.bound
    private setSection(section: Section) {
        this.section = section;
    }

    @action.bound
    private setLevelFilter(level: LevelFilter) {
        this.levelFilter = level;
    }

    @action.bound
    private toggleOnlyIncomplete() {
        this.onlyIncomplete = !this.onlyIncomplete;
    }

    private renderSummary() {
        const clinical = this.completenessStore.clinicalRows;
        const profiles = this.completenessStore.profileRows;
        const panels = this.completenessStore.genePanelRows;

        const tile = (
            section: Section,
            label: string,
            value: React.ReactNode,
            detail: React.ReactNode
        ) => (
            <button
                type="button"
                className={classnames(styles.tile, {
                    [styles.tileActive]: this.section === section,
                })}
                onClick={() => this.setSection(section)}
                data-test={`data-completeness-${section}`}
            >
                <span className={styles.tileLabel}>{label}</span>
                <span className={styles.tileValue}>{value}</span>
                <span className={styles.tileDetail}>{detail}</span>
            </button>
        );

        const completeCount = (rows: CoverageRow[]) =>
            rows.filter(r => r.total > 0 && r.withData === r.total).length;

        return (
            <div className={styles.summary}>
                {tile(
                    Section.CLINICAL,
                    'Clinical attributes',
                    clinical.isComplete ? clinical.result.length : '…',
                    clinical.isComplete
                        ? `${completeCount(clinical.result)} fully complete`
                        : 'loading'
                )}
                {tile(
                    Section.PROFILES,
                    'Molecular profiles',
                    profiles.isComplete ? profiles.result.length : '…',
                    profiles.isComplete
                        ? `${completeCount(profiles.result)} cover all samples`
                        : 'loading'
                )}
                {tile(
                    Section.GENE_PANELS,
                    'Gene panels',
                    panels.isComplete
                        ? _.compact(panels.result.map(r => r.genePanelId))
                              .length
                        : '…',
                    panels.isComplete
                        ? this.genePanelTileDetail(panels.result)
                        : 'loading'
                )}
            </div>
        );
    }

    private genePanelTileDetail(rows: GenePanelCompletenessRow[]) {
        const wholeGenome = rows.find(r => !r.genePanelId);
        if (rows.length === 0) {
            return 'no panel data';
        }
        return wholeGenome
            ? `+ ${wholeGenome.withData.toLocaleString()} WES/WGS samples`
            : `${_.sumBy(rows, r => r.withData).toLocaleString()} samples`;
    }

    private renderClinicalControls() {
        const levels: { value: LevelFilter; label: string }[] = [
            { value: 'all', label: 'All' },
            { value: CompletenessLevel.PATIENT, label: 'Patient' },
            { value: CompletenessLevel.SAMPLE, label: 'Sample' },
        ];
        return (
            <div className={styles.controls}>
                <div className="btn-group btn-group-xs" role="group">
                    {levels.map(l => (
                        <button
                            key={l.value}
                            type="button"
                            className={classnames('btn', 'btn-default', {
                                active: this.levelFilter === l.value,
                            })}
                            onClick={() => this.setLevelFilter(l.value)}
                        >
                            {l.label}
                        </button>
                    ))}
                </div>
                {this.renderIncompleteToggle()}
            </div>
        );
    }

    private renderIncompleteToggle() {
        return (
            <label className={styles.checkbox}>
                <input
                    type="checkbox"
                    checked={this.onlyIncomplete}
                    onChange={this.toggleOnlyIncomplete}
                />{' '}
                Only show incomplete
            </label>
        );
    }

    private renderSectionIntro(text: React.ReactNode) {
        return (
            <p className={styles.intro}>
                {text}
                {this.isMultiStudy && (
                    <>
                        {' '}
                        Per-study columns show coverage within each study;{' '}
                        <span className={styles.studyCellUnavailable}>
                            n/a
                        </span>{' '}
                        means the study does not include that data at all.
                    </>
                )}
            </p>
        );
    }

    private renderClinical() {
        const rows = this.completenessStore.clinicalRows;
        if (rows.isPending) {
            return <LoadingIndicator isLoading={true} center={true} />;
        }
        if (rows.isError) {
            return this.renderError();
        }
        return (
            <>
                {this.renderSectionIntro(
                    <>
                        Share of selected patients (patient attributes) or
                        samples (sample attributes) with a non-empty value.
                        Values of <code>NA</code> count as missing.
                    </>
                )}
                <ClinicalTable
                    key={`clinical-${this.studyIds.join(',')}`}
                    data={this.filteredClinicalRows}
                    columns={this.clinicalColumns}
                    initialSortColumn={COMPLETENESS_COLUMN}
                    initialSortDirection="desc"
                    initialItemsPerPage={50}
                    showColumnVisibility={true}
                    showCopyDownload={true}
                    showFilter={true}
                    showFilterClearButton={true}
                    filterPlaceholder="Search attributes"
                    enableHorizontalScroll={this.isMultiStudy}
                    itemsLabel="attribute"
                    itemsLabelPlural="attributes"
                    showCountHeader={true}
                    customControls={this.renderClinicalControls()}
                />
            </>
        );
    }

    private renderProfiles() {
        const rows = this.completenessStore.profileRows;
        if (rows.isPending) {
            return <LoadingIndicator isLoading={true} center={true} />;
        }
        if (rows.isError) {
            return this.renderError();
        }
        return (
            <>
                {this.renderSectionIntro(
                    <>
                        Share of selected samples profiled for each molecular
                        profile, including generic assay data (e.g. treatment
                        response, signatures, ancestry).
                    </>
                )}
                <ProfileTable
                    key={`profiles-${this.studyIds.join(',')}`}
                    data={this.filteredProfileRows}
                    columns={this.profileColumns}
                    initialSortColumn={COMPLETENESS_COLUMN}
                    initialSortDirection="desc"
                    initialItemsPerPage={50}
                    showColumnVisibility={true}
                    showCopyDownload={true}
                    showFilter={true}
                    showFilterClearButton={true}
                    filterPlaceholder="Search profiles"
                    enableHorizontalScroll={this.isMultiStudy}
                    itemsLabel="profile"
                    itemsLabelPlural="profiles"
                    showCountHeader={true}
                    customControls={
                        <div className={styles.controls}>
                            {this.renderIncompleteToggle()}
                        </div>
                    }
                />
            </>
        );
    }

    private renderGenePanels() {
        const rows = this.completenessStore.genePanelRows;
        if (rows.isPending) {
            return <LoadingIndicator isLoading={true} center={true} />;
        }
        if (rows.isError) {
            return this.renderError();
        }
        if (rows.result.length === 0) {
            return (
                <p className={styles.intro}>
                    No gene panel information is available for the selected
                    samples.
                </p>
            );
        }
        return (
            <>
                {this.renderSectionIntro(
                    <>
                        Selected samples by the gene panel used for mutation,
                        copy number and structural variant profiling. Samples
                        without a panel were profiled genome- or exome-wide.
                    </>
                )}
                <GenePanelTable
                    key={`panels-${this.studyIds.join(',')}`}
                    data={rows.result}
                    columns={this.genePanelColumns}
                    initialSortColumn="Samples with panel"
                    initialSortDirection="desc"
                    initialItemsPerPage={50}
                    showColumnVisibility={true}
                    showCopyDownload={true}
                    showFilter={true}
                    showFilterClearButton={true}
                    filterPlaceholder="Search panels"
                    enableHorizontalScroll={this.isMultiStudy}
                    itemsLabel="gene panel"
                    itemsLabelPlural="gene panels"
                    showCountHeader={true}
                />
            </>
        );
    }

    private renderError() {
        return (
            <div className="alert alert-danger">
                Failed to load data completeness information.
            </div>
        );
    }

    render() {
        if (this.props.store.selectedSamples.isPending) {
            return <LoadingIndicator isLoading={true} center={true} />;
        }
        return (
            <div
                className={styles.dataCompleteness}
                data-test="data-completeness-tab"
            >
                {this.renderSummary()}
                <div className={styles.section}>
                    {this.section === Section.CLINICAL && this.renderClinical()}
                    {this.section === Section.PROFILES && this.renderProfiles()}
                    {this.section === Section.GENE_PANELS &&
                        this.renderGenePanels()}
                </div>
            </div>
        );
    }
}
