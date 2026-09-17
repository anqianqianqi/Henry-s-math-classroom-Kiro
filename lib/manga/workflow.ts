import { mathAnalysisSchema, storyPitchSchema, WorkflowState } from './domain'
import { structuredResponse } from './openai'
import { z } from 'zod'
import { mangaPreferencePrompt } from './preferences'
import { STORY_PITCH_INSTRUCTIONS } from './storyPrompt'

export { STORY_PITCH_INSTRUCTIONS } from './storyPrompt'

const mathJsonSchema = { type:'object', additionalProperties:false, required:['answer','reasoningSteps','mathTakeaway','prerequisites','commonMistakes','visualMetaphors','verification','confidence','ambiguities'], properties:{ answer:{type:'string'}, reasoningSteps:{type:'array',items:{type:'string'}}, mathTakeaway:{type:'string'}, prerequisites:{type:'array',items:{type:'string'}}, commonMistakes:{type:'array',items:{type:'string'}}, visualMetaphors:{type:'array',items:{type:'string'}}, verification:{type:'string'}, confidence:{type:'number'}, ambiguities:{type:'array',items:{type:'string'}} } }
const pitchJsonSchema = { type:'object', additionalProperties:false, required:['pitches'], properties:{ pitches:{type:'array',minItems:5,maxItems:5,items:{type:'object',additionalProperties:false,required:['id','type','title','hook','explicitTask','targetScope','observationPoint','successCriteria','reasonToFindAll','ruleContext','synopsis','mathIntegration','beats','interaction','tone','recommendedTraits','whyItFits','riskNotes'],properties:{id:{type:'string'},type:{type:'string',enum:['funny','warm','interactive','tiktok','instagram']},title:{type:'string'},hook:{type:'string'},explicitTask:{type:'string'},targetScope:{type:'string'},observationPoint:{type:'string'},successCriteria:{type:'string'},reasonToFindAll:{type:'string'},ruleContext:{type:'string'},synopsis:{type:'string'},mathIntegration:{type:'string'},beats:{type:'array',minItems:6,maxItems:18,items:{type:'string'}},interaction:{type:'string'},tone:{type:'string'},recommendedTraits:{type:'array',items:{type:'string'}},whyItFits:{type:'string'},riskNotes:{type:'array',items:{type:'string'}}}}}} }

export async function analyzeMath(state: WorkflowState) {
  return structuredResponse({
    instructions: `You are a rigorous math educator and a precise calculator. Solve the problem completely and independently before writing anything.

CRITICAL RULES:
1. COMPUTE ACTUAL NUMERIC VALUES. Do not just describe a method — execute it.
   - For comparisons involving exponents: compute log₁₀ of each expression to 3 decimal places and list them explicitly.
   - For any comparison problem: show the numeric value or approximation of each item.
2. State the correct answer explicitly in the "answer" field — e.g. "2^100 is the smallest" not "use logarithms to compare".
3. Only flag something as an ambiguity if the problem statement is genuinely unclear or missing information. Do NOT flag "careful simplification required" — that is a method note, not an ambiguity.
4. Set confidence below 0.85 only if the problem is genuinely ambiguous or you are unsure of the answer.
5. Never invent missing conditions.`,
    prompt: JSON.stringify({ problem: state.sourceProblem, gradeLevel: state.gradeLevel, language: state.language }),
    name: 'math_analysis',
    schema: mathJsonSchema,
    validate: mathAnalysisSchema,
  })
}

export async function createStoryPitches(state: WorkflowState) {
  const wrapper = await structuredResponse({ instructions:`${STORY_PITCH_INSTRUCTIONS}\n\nFollow this permanent house preference:\n${mangaPreferencePrompt()}`, prompt:JSON.stringify({problem:state.sourceProblem,math:state.mathAnalysis,language:state.language,renderSpec:state.renderSpec}), name:'story_pitches', schema:pitchJsonSchema, validate:z.object({ pitches: storyPitchSchema.array().length(5) }) })
  return wrapper.pitches.map((pitch) => storyPitchSchema.parse(pitch))
}
