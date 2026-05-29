# How to Generate Didi's Sprite Images

Didi is a **Ragdoll cat** with these exact features:
- Creamy white/off-white fluffy long fur body with a very full chest ruff
- Dark chocolate/seal brown color points: ears, face mask, legs, tail
- White blaze splitting the dark face mask down the center of the face
- Bright vivid blue eyes
- Large chunky build, very fluffy
- Long dark bushy tail

## Generate with ChatGPT / DALL-E / Midjourney / Adobe Firefly

Use this base prompt for each pose, replacing `[POSE DESCRIPTION]`:

```
A cute illustrated Ragdoll cat named Didi, chibi cartoon style, 
white fluffy body with dark chocolate brown color points on ears, 
face mask, legs and tail, white blaze on face, bright blue eyes, 
pink nose, very fluffy chest ruff, [POSE DESCRIPTION], 
transparent background, full body visible, 
soft watercolor illustration style, no background, PNG
```

### Pose descriptions:

**didi-idle.png**
> sitting upright facing forward, looking at viewer with bright blue eyes, tail curled around paws, calm expression

**didi-sleeping.png**
> curled up in a loaf position, eyes closed, sleeping peacefully, small ZZZ floating above head

**didi-yawning.png**
> sitting upright, mouth wide open in a big yawn, eyes squinted shut, tongue visible, front paws stretched forward

**didi-playing.png**
> one front paw raised and batting at a small orange ball, wide alert eyes, playful expression, slightly leaning forward

**didi-walking.png**
> walking in profile/side view, mid-stride with one front paw raised, tail held up, looking forward

## File requirements
- Format: PNG with transparent background
- Size: 200×200px minimum (square)
- Save to: `/public/didi/` folder

## Recommended tools
- **ChatGPT** (DALL-E 3): paste the prompt directly
- **Midjourney**: add `--no background --style cute` 
- **Adobe Firefly**: use "Generative Fill" with transparent background
- **Canva AI**: works well for chibi/cartoon style

Once images are saved, the desktop pet will automatically use them.
