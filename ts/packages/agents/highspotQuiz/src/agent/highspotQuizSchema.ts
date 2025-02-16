export type HighspotQuizAction = |
    GenerateQuizAction

export interface GenerateQuizAction {
    actionName: "generateQuiz",
    parameters: {
        num_questions: number,
        quizTitle: string,
        item: string
    }
}

export interface ModifyQuizAction {
    actionName: "modifyQuiz",
    parameters: {
        question: string,
        quizTitle: string,
        updateQuery: string
    }
}

export interface DeleteQuizAction {
    actionName: "deleteQuiz",
    parameters: {
        title: string
    }
}

export interface exportQuizAction {
    actionName: "exportQuiz",
    parameters: {
        title: string
        target: string
    }
}
