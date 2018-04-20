import * as React from 'react';
import { Modal, ModalBody, ModalHeader } from 'react-bootstrap';
import AppConfig from "appConfig";

import './guessCancerModal.scss';

export default class GuessCancerTypeModal extends React.Component<{patientId:string, studyId:string}, { showModal:boolean }> {

    constructor(){
        super();
        this.toggleState = this.toggleState.bind(this);

        this.state = { showModal:false }

    }

    toggleState(){
        if (this.state.showModal) {
            this.setState({showModal:false})
        } else {
            this.setState({showModal:true})
        }
    }

    render(){

        return (
            <div className="text-center">
                <button onClick={this.toggleState} className="btn btn-primary btn-xl">Guess Cancer Type</button>
                <Modal show={this.state.showModal} animation={false} dialogClassName={'cbioportal-frontend guessCancerModal'} onHide={this.toggleState} >
                    <ModalBody style={{padding:0,marginTop:-100}}>
                          <iframe src={`https://docs.google.com/forms/d/e/${AppConfig.guessCancerTypeForm}/viewform?usp=pp_url&entry.59271867&entry.386158611=${AppConfig.userEmailAddress}&entry.2010502210=${this.props.studyId}&entry.965621196=${this.props.patientId}&embedded=true`} width={760} height={1000} frameBorder={0} marginHeight={-200} scrolling={"no"} marginWidth={0} style={{top:-100}}>Loading...</iframe>
                    </ModalBody>
                </Modal>
            </div>
        )


    }



}
