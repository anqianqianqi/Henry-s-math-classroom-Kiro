import { z } from 'zod'

export const characterBibleSchema = z.object({
  name:z.string(), classroomRole:z.string(), coreTraits:z.array(z.string()), strengths:z.array(z.string()), flaws:z.array(z.string()),
  desire:z.string(), fear:z.string(), underPressure:z.string(), humorMechanism:z.string(), mathRelationship:z.string(),
  speakingStyle:z.string(), catchphrases:z.array(z.string()), neverSays:z.array(z.string()),
  entityType:z.string(), silhouette:z.string(), signatureOutfit:z.string(), palette:z.array(z.object({name:z.string(),hex:z.string(),usage:z.string()})),
  immutableAnchors:z.array(z.string()), forbiddenElements:z.array(z.string()), expressionRange:z.array(z.string()), canonicalPrompt:z.string(), negativePrompt:z.string(),
})
export type CharacterBible = z.infer<typeof characterBibleSchema>

export const characterInterviewRequestSchema = z.object({
  seed:z.string().min(2).max(6000), language:z.enum(['zh','en']).default('zh'),
  answers:z.array(z.object({question:z.string(),answer:z.string()})).default([]), currentDraft:characterBibleSchema.nullable().default(null),
})
export const characterInterviewResponseSchema = z.object({
  completeness:z.number().int().min(0).max(100), summary:z.string(), readyForApproval:z.boolean(), draft:characterBibleSchema,
  questions:z.array(z.object({id:z.string(),question:z.string(),whyItMatters:z.string(),recommendations:z.array(z.object({label:z.string(),reason:z.string()})).min(2).max(4)})).max(3),
})

export const characterInterviewJsonSchema = {
  type:'object',additionalProperties:false,required:['completeness','summary','readyForApproval','draft','questions'],properties:{
    completeness:{type:'integer'},summary:{type:'string'},readyForApproval:{type:'boolean'},
    questions:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['id','question','whyItMatters','recommendations'],properties:{id:{type:'string'},question:{type:'string'},whyItMatters:{type:'string'},recommendations:{type:'array',minItems:2,maxItems:4,items:{type:'object',additionalProperties:false,required:['label','reason'],properties:{label:{type:'string'},reason:{type:'string'}}}}}}},
    draft:{type:'object',additionalProperties:false,required:['name','classroomRole','coreTraits','strengths','flaws','desire','fear','underPressure','humorMechanism','mathRelationship','speakingStyle','catchphrases','neverSays','entityType','silhouette','signatureOutfit','palette','immutableAnchors','forbiddenElements','expressionRange','canonicalPrompt','negativePrompt'],properties:{
      name:{type:'string'},classroomRole:{type:'string'},coreTraits:{type:'array',items:{type:'string'}},strengths:{type:'array',items:{type:'string'}},flaws:{type:'array',items:{type:'string'}},desire:{type:'string'},fear:{type:'string'},underPressure:{type:'string'},humorMechanism:{type:'string'},mathRelationship:{type:'string'},speakingStyle:{type:'string'},catchphrases:{type:'array',items:{type:'string'}},neverSays:{type:'array',items:{type:'string'}},entityType:{type:'string'},silhouette:{type:'string'},signatureOutfit:{type:'string'},palette:{type:'array',items:{type:'object',additionalProperties:false,required:['name','hex','usage'],properties:{name:{type:'string'},hex:{type:'string'},usage:{type:'string'}}}},immutableAnchors:{type:'array',items:{type:'string'}},forbiddenElements:{type:'array',items:{type:'string'}},expressionRange:{type:'array',items:{type:'string'}},canonicalPrompt:{type:'string'},negativePrompt:{type:'string'}
    }}
  }
} as const
