import { mathAnalysisSchema, storyPitchSchema, WorkflowState } from './domain'
import { structuredResponse } from './openai'
import { z } from 'zod'
import { mangaPreferencePrompt } from './preferences'

const mathJsonSchema = { type:'object', additionalProperties:false, required:['answer','reasoningSteps','mathTakeaway','prerequisites','commonMistakes','visualMetaphors','verification','confidence','ambiguities'], properties:{ answer:{type:'string'}, reasoningSteps:{type:'array',items:{type:'string'}}, mathTakeaway:{type:'string'}, prerequisites:{type:'array',items:{type:'string'}}, commonMistakes:{type:'array',items:{type:'string'}}, visualMetaphors:{type:'array',items:{type:'string'}}, verification:{type:'string'}, confidence:{type:'number'}, ambiguities:{type:'array',items:{type:'string'}} } }
const pitchJsonSchema = { type:'object', additionalProperties:false, required:['pitches'], properties:{ pitches:{type:'array',minItems:5,maxItems:5,items:{type:'object',additionalProperties:false,required:['id','type','title','hook','synopsis','mathIntegration','beats','interaction','tone','recommendedTraits','whyItFits','riskNotes'],properties:{id:{type:'string'},type:{type:'string',enum:['funny','warm','interactive','tiktok','instagram']},title:{type:'string'},hook:{type:'string'},synopsis:{type:'string'},mathIntegration:{type:'string'},beats:{type:'array',minItems:6,maxItems:6,items:{type:'string'}},interaction:{type:'string'},tone:{type:'string'},recommendedTraits:{type:'array',items:{type:'string'}},whyItFits:{type:'string'},riskNotes:{type:'array',items:{type:'string'}}}}}} }

export async function analyzeMath(state: WorkflowState) {
  return structuredResponse({ instructions:'You are a rigorous math educator. Solve independently, verify the result, flag ambiguity, and produce child-appropriate teaching insight. Never invent missing conditions.', prompt:JSON.stringify({problem:state.sourceProblem,gradeLevel:state.gradeLevel,language:state.language}), name:'math_analysis', schema:mathJsonSchema, validate:mathAnalysisSchema })
}

export async function createStoryPitches(state: WorkflowState) {
  const wrapper = await structuredResponse({ instructions:`You are an educational comic story editor. Create exactly five structurally different six-beat pitches. Math must drive the action. Never humiliate a child for mistakes. Follow this permanent house preference:\n${mangaPreferencePrompt()}`, prompt:JSON.stringify({problem:state.sourceProblem,math:state.mathAnalysis,language:state.language,renderSpec:state.renderSpec}), name:'story_pitches', schema:pitchJsonSchema, validate:z.object({ pitches: storyPitchSchema.array().length(5) }) })
  return wrapper.pitches
}
