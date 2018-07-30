import * as React from "react";
import annotationStyles from "./../styles/annotation.module.scss";
import classNames from 'classnames';
import {MyVariantInfo as MyVariantInfoData} from 'shared/api/generated/GenomeNexusAPIInternal';
<<<<<<< HEAD
=======
import myVariantInfoColumn from "./styles/MyVariantInfoColumn.module.scss";
>>>>>>> new dbsnp rsid column

export interface IMyVariantInfoProps {
    myVariantInfo: MyVariantInfoData;
}

export default class MyVariantInfo extends React.Component<IMyVariantInfoProps, {}> {
    public static download(myVariantInfoData: MyVariantInfoData|undefined): string
    {
        if (myVariantInfoData) {
            return `rsid: ${myVariantInfoData.dbsnp.rsid}`;
        }
        else {
            return "Error";
        }
    }

    public render() {
        let mviContent: JSX.Element = (
            <span className={`${annotationStyles["annotation-item-text"]}`}/>
        )
<<<<<<< HEAD
        if (this.props.myVariantInfo && this.props.myVariantInfo.dbsnp && this.props.myVariantInfo.dbsnp.rsid !== null) {
            mviContent = (
                <span className={classNames(annotationStyles["annotation-item-text"])}>
                {this.props.myVariantInfo.dbsnp.rsid}
=======
        if (this.props.myVariantInfo && this.props.myVariantInfo.dbsnp !== null) {
            const mviData = this.props.myVariantInfo;
            mviContent = (
                <span className={classNames(annotationStyles["annotation-item-text"])}>
>>>>>>> new dbsnp rsid column
                </span>
            );
        }
        return mviContent;
    }
}