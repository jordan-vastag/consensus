# Consensus

Group decision making tool

## Requirements

### Functional

1. A user can host a session from their device

    1. Session can be customized: anonymity, mode (yes/no or ranked choice), max/min number of choices, grace period length, allow empty-listers to vote

1. Other users can join the lobby via the lobby code

1. During the lobby stage:

    1. Lobby members can change their display name

    1. Lobby members add choices to their list and edit it after saving

        1. Choices can be added manually, or via integration (choice from TMDB, Letterboxd list, Google maps list)

            1. Members can add comments to each choice e.g. "Revenge thriller starring Keanu Reeves and (briefly), a dog"

            1. Choices added via integration will have metadata visible during the voting stage

        1. When saving a list, members are automatically marked as 'Ready'

        1. While editing a list, members are automatically marked as 'Unready'

    1. 'Ready' members can cancel their readiness

    1. If every lobby member is ready, the voting stage automatically commences after a short (cancelable by host) grace period

    1. The host can manually start the voting stage at any time

        1. After clicking 'Start', the voting stage commences after a short (cancelable by host) grace period

            1. If members are actively adding to their list when the host clicks 'Start', the host will be asked to confirm. Once confirmed, the grace period begins

        1. Unsaved lists will not be added to the aggregate list in the voting stage

            1. If a member is actively editing a saved list, the last version of the list will be used
        
        1. Empty lists will not be added to the aggregate list in the voting stage

1. During the voting stage:

    1. Individual lists are combined into an aggregate list

    1. Each member votes on every option in the aggregate list (view depends on mode)

        1. For yes/no, multiple views are available:
            
            1. Each option is shown one by one and the user swipes yes or no

                - If populated, comments and metadata are shown alongside the choice

                    - If a choice added via integration has a thumbnail available, it is displayed

                - After all choices have been voted on, the user can submit their vote or review their choices
                
                    - Reviewing choices utilizes the list view.

            1. List of all option is shown and the the user clicks yes or no
                
                - A submit button is below the list.

        1. For ranked choice, each option is shown in a list that can be modified by dragging and dropping or manually editing the ordering number

    1. Once all members submit their vote, the aggregate list is sorted by most votes to least and displayed to all users

    1. The lobby host can manually end voting before all members submit their vote - this action requires a confirmation

        1. If a member has not submitted their vote, none of their current votes will be considered

### Non-functional

1. Application is containerized with Docker

1. All errors are logged

1. Metrics are emitted 
    
    1. Total number of requests per endpoint

    1. Availability