import { getItemContent } from "./endpoints.js";
import { HighspotService } from "./service.js";

export interface HighspotQuiz {
    title: string;
    item: string;
    questions: string[];
}

export async function generateQuiz(
    num_questions: number,
    quizTitle: string,
    item: string,
    service: HighspotService
): Promise<HighspotQuiz> {
    // get item, generate index from item, generate quiz from index
    const itemContent = await getItemContent(service, item);
    console.log(itemContent);

    return {
        title: quizTitle,
        item: item,
        questions: []
    };
}
