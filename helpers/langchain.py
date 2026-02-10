"""
lit-prompt-config LangChain integration helper.

Convert lit-prompt-config JSON to LangChain prompt templates and LLM instances.

Usage:
    from lit_prompt_config import from_config

    config = load_your_config_json()  # e.g., from database, file, etc.
    prompt, llm = from_config(config)

    chain = prompt | llm
    result = chain.invoke({"article_text": "..."})
"""

import re
from typing import Any, Tuple, List, Optional


def extract_variables(template: Optional[str]) -> List[str]:
    """Extract variable names from a template with {{variable}} placeholders."""
    if not template:
        return []
    matches = re.findall(r'\{\{(\w+)\}\}', template)
    return list(set(matches))


def convert_template(template: Optional[str]) -> str:
    """Convert {{variable}} placeholders to LangChain's {variable} format."""
    if not template:
        return ""
    return re.sub(r'\{\{(\w+)\}\}', r'{\1}', template)


def to_prompt_template(config: dict) -> "ChatPromptTemplate":
    """
    Convert a PromptConfig to a LangChain ChatPromptTemplate.

    Args:
        config: The prompt configuration dictionary

    Returns:
        A ChatPromptTemplate instance

    Example:
        >>> prompt = to_prompt_template(config)
        >>> prompt.invoke({"article_text": "..."})
    """
    from langchain_core.prompts import ChatPromptTemplate

    messages = []

    if config.get('systemPrompt'):
        messages.append(('system', config['systemPrompt']))

    user_template = convert_template(config.get('userPromptTemplate', ''))
    if user_template:
        messages.append(('user', user_template))

    return ChatPromptTemplate.from_messages(messages)


def get_model_kwargs(config: dict) -> dict:
    """
    Extract model configuration kwargs from a PromptConfig.

    Args:
        config: The prompt configuration dictionary

    Returns:
        Dictionary of model kwargs (temperature, max_tokens, etc.)
    """
    kwargs = {
        'temperature': config.get('temperature', 1.0),
        'max_tokens': config.get('maxTokens', 4096),
    }

    if config.get('topP') is not None and config.get('topP') != 1:
        kwargs['top_p'] = config['topP']

    if config.get('stopSequences'):
        kwargs['stop'] = config['stopSequences']

    return kwargs


def get_provider(model_id: str) -> str:
    """
    Extract provider name from an OpenRouter model ID.

    Args:
        model_id: e.g., "anthropic/claude-sonnet-4-5"

    Returns:
        Provider name, e.g., "anthropic"
    """
    return model_id.split('/')[0] if '/' in model_id else 'unknown'


def create_llm(config: dict, api_key: Optional[str] = None) -> Any:
    """
    Create a LangChain LLM instance from a PromptConfig.

    Supports Anthropic, OpenAI, and falls back to OpenRouter via OpenAI-compatible API.

    Args:
        config: The prompt configuration dictionary
        api_key: Optional API key (uses environment variables if not provided)

    Returns:
        A LangChain chat model instance

    Example:
        >>> llm = create_llm(config, api_key="sk-...")
        >>> llm.invoke([HumanMessage(content="Hello")])
    """
    model_id = config.get('model', '')
    provider = get_provider(model_id)
    kwargs = get_model_kwargs(config)

    if provider == 'anthropic':
        from langchain_anthropic import ChatAnthropic
        # Extract the model name without provider prefix
        model_name = model_id.split('/')[-1] if '/' in model_id else model_id
        if api_key:
            kwargs['anthropic_api_key'] = api_key
        return ChatAnthropic(model=model_name, **kwargs)

    elif provider == 'openai':
        from langchain_openai import ChatOpenAI
        model_name = model_id.split('/')[-1] if '/' in model_id else model_id
        if api_key:
            kwargs['openai_api_key'] = api_key
        return ChatOpenAI(model=model_name, **kwargs)

    else:
        # Default to OpenRouter via OpenAI-compatible API
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_id,
            base_url='https://openrouter.ai/api/v1',
            api_key=api_key,
            **kwargs
        )


def from_config(
    config: dict,
    api_key: Optional[str] = None
) -> Tuple["ChatPromptTemplate", Any]:
    """
    Convert a lit-prompt-config JSON to LangChain prompt template and LLM.

    This is the main entry point for using lit-prompt-config with LangChain.

    Args:
        config: The prompt configuration dictionary (from the <prompt-config> component)
        api_key: Optional API key for the LLM provider

    Returns:
        Tuple of (ChatPromptTemplate, ChatModel)

    Example:
        >>> import json
        >>>
        >>> # Load config from wherever you stored it
        >>> with open('my-prompt.json') as f:
        ...     config = json.load(f)
        >>>
        >>> # Create LangChain objects
        >>> prompt, llm = from_config(config, api_key="sk-...")
        >>>
        >>> # Use in a chain
        >>> chain = prompt | llm
        >>> result = chain.invoke({"article_text": "The quick brown fox..."})
        >>> print(result.content)
    """
    prompt = to_prompt_template(config)
    llm = create_llm(config, api_key)
    return prompt, llm


# For backwards compatibility
__all__ = [
    'from_config',
    'to_prompt_template',
    'create_llm',
    'get_model_kwargs',
    'get_provider',
    'extract_variables',
    'convert_template',
]
