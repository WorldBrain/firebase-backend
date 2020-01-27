const mergeStringArrays = (left: string[], right: string[]) => {
    return [...new Set([...left, ...right])]
}

export const mergeTermFields = (fieldName: string, left: any, right: any) => {
    const oldTerms = left[fieldName] || []
    const addedTerms = right[fieldName] || []
    return mergeStringArrays(oldTerms, addedTerms)
}
