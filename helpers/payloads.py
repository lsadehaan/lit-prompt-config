"""
lit-prompt-config payload helpers.

Convert PromptConfig dictionaries to provider-specific API payloads.
These are ready-to-send request bodies - just add your API key.

Usage:
    from lit_prompt_config.payloads import to_openai_payload, to_anthropic_payload

    config = load_your_config()  # from database, file, etc.

    # For OpenAI / OpenRouter
    payload = to_openai_payload(config, {"article_text": "..."})

    # For Anthropic
    payload = to_anthropic_payload(config, {"article_text": "..."})
"""

import re
from typing import Any, Dict, List, Optional


def resolve_template(template: Optional[str], variables: Dict[str, str]) -> str:
    """
    Resolve {{variable}} placeholders in a template string.

    Args:
        template: Template string with {{variable}} placeholders
        variables: Dictionary of variable values

    Returns:
        Template with variables substituted
    """
    if not template:
        return ""

    def replace(match):
        key = match.group(1)
        return variables.get(key, f"{{{{{key}}}}}")

    return re.sub(r'\{\{(\w+)\}\}', replace, template)


def to_openai_payload(
    config: Dict[str, Any],
    variables: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Convert a PromptConfig to an OpenAI-compatible API payload.

    Works with: OpenAI, OpenRouter, Azure OpenAI, Ollama, LMStudio,
    and any other OpenAI-compatible API.

    Args:
        config: The prompt configuration dictionary
        variables: Runtime variables to substitute in the user prompt template

    Returns:
        OpenAI-compatible request body

    Example:
        >>> payload = to_openai_payload(config, {"article_text": "..."})
        >>>
        >>> # OpenAI
        >>> response = openai.chat.completions.create(**payload)
        >>>
        >>> # OpenRouter
        >>> requests.post(
        ...     "https://openrouter.ai/api/v1/chat/completions",
        ...     headers={"Authorization": f"Bearer {API_KEY}"},
        ...     json=payload
        ... )
    """
    variables = variables or {}
    merged_vars = {**config.get('sampleInputs', {}), **variables}

    # Build messages array
    messages: List[Dict[str, str]] = []

    if config.get('systemPrompt'):
        messages.append({
            "role": "system",
            "content": config['systemPrompt']
        })

    user_content = resolve_template(config.get('userPromptTemplate'), merged_vars)
    if user_content:
        messages.append({
            "role": "user",
            "content": user_content
        })

    payload: Dict[str, Any] = {
        "model": config.get('model', ''),
        "messages": messages,
    }

    # Optional parameters (only include if set)
    if config.get('temperature') is not None:
        payload['temperature'] = config['temperature']

    if config.get('maxTokens'):
        payload['max_tokens'] = config['maxTokens']

    if config.get('topP') is not None and config.get('topP') != 1:
        payload['top_p'] = config['topP']

    if config.get('topK'):
        payload['top_k'] = config['topK']

    if config.get('frequencyPenalty'):
        payload['frequency_penalty'] = config['frequencyPenalty']

    if config.get('presencePenalty'):
        payload['presence_penalty'] = config['presencePenalty']

    if config.get('repetitionPenalty') and config.get('repetitionPenalty') != 1:
        payload['repetition_penalty'] = config['repetitionPenalty']

    if config.get('minP'):
        payload['min_p'] = config['minP']

    if config.get('stopSequences'):
        payload['stop'] = config['stopSequences']

    # Response format
    response_format = config.get('responseFormat')
    if response_format == 'json_object':
        payload['response_format'] = {"type": "json_object"}
    elif response_format == 'json_schema' and config.get('jsonSchema'):
        payload['response_format'] = {
            "type": "json_schema",
            "json_schema": config['jsonSchema']
        }

    # Tools
    if config.get('tools'):
        payload['tools'] = config['tools']
        if config.get('toolChoice') and config.get('toolChoice') != 'auto':
            payload['tool_choice'] = config['toolChoice']

    # Reasoning (OpenRouter extension)
    if config.get('reasoning'):
        payload['reasoning'] = {
            "effort": config.get('reasoningEffort', 'medium')
        }

    return payload


# Alias - OpenRouter uses the same format as OpenAI
to_openrouter_payload = to_openai_payload


def to_anthropic_payload(
    config: Dict[str, Any],
    variables: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Convert a PromptConfig to an Anthropic API payload.

    Note: Anthropic's API differs from OpenAI:
    - system prompt is a top-level parameter, not in messages
    - max_tokens is required
    - some parameters have different names

    Args:
        config: The prompt configuration dictionary
        variables: Runtime variables to substitute in the user prompt template

    Returns:
        Anthropic-compatible request body

    Example:
        >>> payload = to_anthropic_payload(config, {"article_text": "..."})
        >>>
        >>> response = anthropic.messages.create(**payload)
        >>>
        >>> # Or with requests
        >>> requests.post(
        ...     "https://api.anthropic.com/v1/messages",
        ...     headers={
        ...         "x-api-key": API_KEY,
        ...         "anthropic-version": "2023-06-01"
        ...     },
        ...     json=payload
        ... )
    """
    variables = variables or {}
    merged_vars = {**config.get('sampleInputs', {}), **variables}

    # Build messages array (no system message - it's separate in Anthropic)
    messages: List[Dict[str, str]] = []

    user_content = resolve_template(config.get('userPromptTemplate'), merged_vars)
    if user_content:
        messages.append({
            "role": "user",
            "content": user_content
        })

    # Extract model name (remove provider prefix if present)
    model = config.get('model', '')
    if '/' in model:
        model = model.split('/')[-1]

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": config.get('maxTokens', 4096),  # Required for Anthropic
    }

    # System prompt is top-level in Anthropic
    if config.get('systemPrompt'):
        payload['system'] = config['systemPrompt']

    # Optional parameters
    if config.get('temperature') is not None:
        payload['temperature'] = config['temperature']

    if config.get('topP') is not None and config.get('topP') != 1:
        payload['top_p'] = config['topP']

    if config.get('topK'):
        payload['top_k'] = config['topK']

    if config.get('stopSequences'):
        payload['stop_sequences'] = config['stopSequences']

    # Tools
    if config.get('tools'):
        # Convert OpenAI tool format to Anthropic format
        anthropic_tools = []
        for tool in config['tools']:
            if tool.get('type') == 'function' and tool.get('function'):
                func = tool['function']
                anthropic_tools.append({
                    "name": func.get('name'),
                    "description": func.get('description', ''),
                    "input_schema": func.get('parameters', {})
                })
        if anthropic_tools:
            payload['tools'] = anthropic_tools

            tool_choice = config.get('toolChoice')
            if tool_choice == 'required':
                payload['tool_choice'] = {"type": "any"}
            elif tool_choice == 'none':
                payload['tool_choice'] = {"type": "none"}
            # 'auto' is default, no need to specify

    return payload


__all__ = [
    'to_openai_payload',
    'to_openrouter_payload',
    'to_anthropic_payload',
    'resolve_template',
]
