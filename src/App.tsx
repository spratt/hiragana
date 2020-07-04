import React from 'react';
import styled from 'styled-components';
import yaml from 'js-yaml';
import * as _ from 'lodash';

import xhr from './http';
import {shuffle, randomChoices} from './random';
import {NonEmptyArray, QuestionPicker, NullQuestionPicker, RandomQuestionPicker} from './QuestionPicker';

import data from './data.yaml';

const Tada = String.fromCodePoint(127881);

const Container = styled.div`
  @media screen and (min-width: 48rem) {
  width: 48rem;
  margin: 0 auto;
  }
`;

const Title = styled.h1`
  padding-left: 1rem;
  font-size: 1.5em;
  color: palevioletred;
`;

const BigButton = styled.button`
  font-size: 2rem;
  width: 100%;
`;

const CorrectButton = styled.button`
  font-size: 2rem;
  width: 100%;
  background-color: lightgreen;
`;

const WrongButton = styled.button`
  font-size: 2rem;
  width: 100%;
  background-color: orangered;
`;

const Prompt = styled.h2``;

const Mnemonic = styled.h3``;

interface SummaryProps {
  answered: number;
  correct: number;
  seen: number;
  total: number;
}

function Summary(props: SummaryProps) {
  return (
    <div>
      <div>Correct: {props.correct}</div>
      <div>Answered: {props.answered}</div>
      <div>Seen: {props.seen}/{props.total}</div>
    </div>
  )
}

interface Fact {
  prompt: string;
  response: string;
  related: string[];
  mnemonic: string;
}

interface Question {
  fact: Fact;
  responses: string[];
}

interface AppState {
  facts: Record<string,Fact>;
  responses: string[];
  question: Question;
  answer?: string;

  numCorrect: number;
  numAnswered: number;
  seenSet: Record<string,{}>;
}

class App extends React.Component<{},AppState> {
  private questionPicker: QuestionPicker;
  
  static emptyQuestion = {
    fact: {
      prompt: '',
      response: '',
      related: [],
      mnemonic: '',
    },
    responses: [],
  };

  constructor(props: {}) {
    super(props);
    console.log('new App()');

    this.questionPicker = new NullQuestionPicker();

    // Start async get call
    xhr('GET', data).then((req) => {
      const data = yaml.load(req.response);
      const prompts = Object.keys(data.facts);
      this.questionPicker = new RandomQuestionPicker(prompts as NonEmptyArray<string>);
      const responses = prompts.map((prompt: string) => data.facts[prompt].response);
      this.state = {
        facts: data.facts,
        responses: responses,
        question: App.emptyQuestion,

        numCorrect: 0,
        numAnswered: 0,
        seenSet: {},
      };
      this.nextQuestion();
    }).catch((err) => console.error(err));

    // Initialize empty state while we wait for the xhr to finish
    this.state = {
      facts: {},
      responses: [],
      question: App.emptyQuestion,

      numCorrect: 0,
      numAnswered: 0,
      seenSet: {},
    };
  }
  
  nextQuestion() {
    console.log('nextQuestion() called');
    if (Object.keys(this.state.facts).length === 0) {
      console.log('nextQuestion() empty facts');
      return
    }
    if (!this.questionPicker.isReady()) {
      console.log("this.questionPicker isn't ready");
      return;
    }
    console.log('nextQuestion() this.state');
    console.dir(this.state);
    const key = this.questionPicker.nextQuestion();
    const fact = this.state.facts[key];
    const responses = [fact.response];
    const otherResponses = this.state.responses.filter((response) => response !== fact.response);
    responses.push(...randomChoices(otherResponses, 3));
    const seenSet = _.clone(this.state.seenSet);
    seenSet[fact.prompt] = {};
    const newState = {
      facts: this.state.facts,
      responses: this.state.responses,
      question: {
        fact: fact,
        responses: shuffle(responses),
      },
      answer: undefined,
      seenSet: seenSet,
    };
    console.log('nextQuestion() new state');
    console.dir(newState);
    this.setState(newState);
  }

  handleClick(r: string) {
    if (this.state.answer !== null && this.state.answer !== undefined) return;
    this.setState({
      answer: r,
    });
    const numAnswered = this.state.numAnswered + 1;
    let numCorrect = this.state.numCorrect;
    if (r === this.state.question.fact.response) {
      this.questionPicker.feedback(this.state.question.fact.prompt, true);
      numCorrect++;
    } else {
      this.questionPicker.feedback(this.state.question.fact.prompt, false);
    }
    this.setState({
      numAnswered: numAnswered,
      numCorrect: numCorrect,
    });
  }

  hasAnswered() {
    return this.state.answer !== null && this.state.answer !== undefined;
  }

  isCorrectAnswer(response: string) {
    return response === this.state.question.fact.response;
  }

  isWrongAnswer(response: string) {
    return this.state.answer === response && response !== this.state.question.fact.response;
  }

  renderCard() {
    const buttons = this.state.question.responses.map((response: string, i: number) => {
      if (this.hasAnswered()) {
        if (this.isCorrectAnswer(response)) {
          return (
            <CorrectButton key={i} onClick={() => this.nextQuestion()}>
              {response}
            </CorrectButton>
          );
        } else if (this.isWrongAnswer(response)) {
          return (
            <WrongButton key={i} onClick={() => this.nextQuestion()}>
              {response}
            </WrongButton>
          );
        }
        return (
          <BigButton key={i} onClick={() => this.nextQuestion()}>
            {response}
          </BigButton>
        );
      } else {
        return (
          <BigButton key={i} onClick={() => this.handleClick(response)}>
            {response}
          </BigButton>
        );
      }
    });
    return (
      <div>
        <Prompt>
          {this.state.question.fact.prompt}
        </Prompt>
        {buttons}
      </div>
    );
  }

  renderMnemonic() {
    if (!this.hasAnswered()) return (<Mnemonic />);
    let response = '';
    if (this.isCorrectAnswer(this.state.answer || '')) {
      response = Tada + Tada + Tada + 'Great job!' + Tada + Tada + Tada;
    } else {
      response = 'Try to remember: ' + this.state.question.fact.mnemonic;
    }
    return (
      <Mnemonic>{ response }</Mnemonic>
    );
  }

  render() {
    return (
      <Container>
        <header>
          <Title>
            S.R.S. 日本語
          </Title>
        </header>
        <Summary
          answered={ this.state.numAnswered }
          correct={ this.state.numCorrect }
          seen={ Object.keys(this.state.seenSet).length }
          total={ Object.keys(this.state.facts).length }
        />
        {this.renderCard()}
        {this.renderMnemonic()}
      </Container>
    );
  }
}

export default App;
